import { readGoals } from '@/lib/goal-reader'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { proposeGoals, type ProposeGoalInput, type ProposeGoalsResult } from '@/lib/goal-writer'
import { buildUsageSummary } from '@/lib/usage-store'
import type { ExecutionRun } from '@/types/execution-run'

// 自動実行対象が無い（アイドル）ときに、progress アプリ優先で「改善事項」「試した方がいいこと」を
// ゴール候補（status='proposed'）として実際に登録する。Inbox で承認したものが次回以降の自動実行対象になる。
//
// 設計意図: 既存のアイドル処理 requestGoalProposalIfIdle() は「AIに提案を依頼するプロンプトをログに出す」だけで
// 承認対象を実際には増やさないため、調査(research)から候補が出ない局面では承認対象が空のままになり、
// 次の自動実行も空になりうる。本モジュールは progress 内部のシグナル（失敗 Run / 未消化 nextActions）と
// 定番の改善 seed から決定的に候補を生成し、「次の自動実行が空にならない」状態を保証する。
//
// シグナルの優先順（progress アプリ優先）:
//   1. 失敗/エラー Run の解消（改善事項）   … その後に同名の成功 Run が無いものだけ
//   2. 未消化の nextActions のゴール化（試した方がいいこと）
//   3. 使用状況(usage-log)シグナル … よく開く画面の便利機能 / 放置画面の運用改善（使用状況から自動抽出）
//   4. 定番の progress 改善 seed（1〜3 で枠が埋まらない時のフォールバック＝空回避の保険）

/** 承認待ち(proposed)がこの件数以上なら新規提案しない（承認を促す）。research 側と揃える。 */
const MAX_PENDING_PROPOSALS = 3

/** progress を優先するが、他アプリの失敗も拾う。直近この件数の Run を走査する。 */
const SCAN_RUNS = 60

/** progress アプリ名（targetApp 一致判定）。 */
const PROGRESS_APP = 'progress'

/** 使用状況シグナルの集計窓（日）。/usage の既定と揃える。 */
const USAGE_RANGE_DAYS = 7

/** この窓内でこの回数以上開かれた画面は「よく使う中心画面」とみなし、便利機能の提案対象にする。 */
const HOT_SCREEN_MIN_VIEWS = 8

/**
 * 1・2 で枠が埋まらない時のフォールバック候補。progress アプリの定番改善テーマ。
 * 同名タイトルが既存ゴール（全 status）にあれば除外されるので、承認/却下済みは蒸し返さない。
 */
const PROGRESS_IMPROVEMENT_SEEDS: ProposeGoalInput[] = [
  {
    title: '自動実行レポートの精度を点検・改善する',
    summary: 'ExecutionRun のサマリー/nextActions が後からレビューしやすい粒度になっているか点検し、不足を補う。',
    rationale: '自動実行対象が無いアイドル時間を、自動実行基盤そのものの品質改善に充てる（progress 優先）。',
    enables: '作業履歴の振り返り・Activity Mining の精度が上がる。',
    pros: ['自動実行の成果物（レポート）の質が上がる', 'アイドル時間を基盤改善に転用できる'],
    cons: ['直接の機能追加ではない', '効果測定がしづらい'],
  },
  {
    title: 'doneCriteria 自動判定の精度を点検する',
    summary: 'Factory の done 判定が誤って未完了 Epic を done にしていないか、逆に永遠に continue していないかを点検する。',
    rationale: '自動実行の停止/継続判断の正確さは工場全体の信頼性に直結する（progress 優先）。',
    enables: 'Epic の完了判定が信頼でき、無限ループ/早期打ち切りを減らせる。',
    pros: ['自動実行の信頼性が上がる', '人手レビューの負担が減る'],
    cons: ['判定ルールの調整に検証が必要'],
  },
  {
    title: 'ゴール承認フロー（Inbox）の使い勝手を点検する',
    summary: '提案ゴール（proposed）の承認/却下が Inbox から迷わず行えるか、表示情報（根拠・pros/cons）が十分かを点検する。',
    rationale: 'アイドル時に積んだ提案を人が速く捌けるほど、自動実行が空にならない循環が回る（progress 優先）。',
    enables: '承認の意思決定が速くなり、自動実行対象の補充が滞らない。',
    pros: ['承認のボトルネックが減る', '提案→承認→実行の循環が回りやすくなる'],
    cons: ['UI 改修を伴う場合がある'],
  },
]

interface FailureSignal {
  title: string
  app: string
  errorHint: string
  finishedAt: string
}

/** progress を先頭に寄せる安定ソート用キー（progress=0 / その他=1）。 */
function appRank(app: string): number {
  return app === PROGRESS_APP ? 0 : 1
}

/**
 * 失敗/エラーで終わった Run のうち、その後に同名(title)の成功 Run が無いものを「未解決の失敗」として抽出する。
 * runs は新しい順で渡される前提。
 */
function collectUnresolvedFailures(runs: ExecutionRun[]): FailureSignal[] {
  // title ごとに最新の成功時刻を控える（その時刻より前の失敗は解消済みとみなす）。
  const latestSuccessAt = new Map<string, number>()
  for (const r of runs) {
    if (r.runStatus === 'completed') {
      const t = new Date(r.finishedAt || r.startedAt).getTime()
      const prev = latestSuccessAt.get(r.targetTodoTitle) ?? 0
      if (t > prev) latestSuccessAt.set(r.targetTodoTitle, t)
    }
  }
  const seen = new Set<string>()
  const out: FailureSignal[] = []
  for (const r of runs) {
    const failed = r.runStatus === 'failed' || (Array.isArray(r.errors) && r.errors.length > 0)
    if (!failed) continue
    const title = (r.targetTodoTitle || '').trim()
    if (!title || seen.has(title)) continue
    const failedAt = new Date(r.finishedAt || r.startedAt).getTime()
    const successAt = latestSuccessAt.get(r.targetTodoTitle) ?? 0
    if (successAt >= failedAt) continue // 後で成功しているので解消済み
    seen.add(title)
    out.push({
      title,
      app: r.targetApp || PROGRESS_APP,
      errorHint: (r.errors?.[0] ?? r.stopReason ?? r.summary ?? '').slice(0, 160),
      finishedAt: r.finishedAt || r.startedAt,
    })
  }
  // progress 優先で並べる。
  return out.sort((a, b) => appRank(a.app) - appRank(b.app))
}

/** 未消化の nextActions を Run から集める（重複排除・progress 優先）。 */
function collectNextActions(runs: ExecutionRun[]): Array<{ text: string; app: string }> {
  const seen = new Set<string>()
  const out: Array<{ text: string; app: string }> = []
  for (const r of runs) {
    if (!Array.isArray(r.nextActions)) continue
    for (const raw of r.nextActions) {
      const text = (raw || '').trim()
      if (!text || text.length < 4) continue
      if (seen.has(text)) continue
      seen.add(text)
      out.push({ text, app: r.targetApp || PROGRESS_APP })
    }
  }
  return out.sort((a, b) => appRank(a.app) - appRank(b.app))
}

function failureToCandidate(f: FailureSignal): ProposeGoalInput {
  const isProgress = f.app === PROGRESS_APP
  return {
    title: `「${f.title}」の失敗を解消する`,
    summary: `自動実行で失敗/エラーのまま未解消の作業。${f.errorHint ? `直近のエラー: ${f.errorHint}` : ''}`.slice(0, 200),
    projectId: undefined,
    metric: 'progress',
    target: 100,
    current: 0,
    priority: isProgress ? 'P0' : 'P1',
    rationale: `targetApp=${f.app} の Run が失敗のまま成功 Run で上書きされていない（最終 ${f.finishedAt}）。改善事項として解消をゴール化。`,
    source: 'app_improvement',
    enables: '失敗していた作業が完了し、自動実行が前に進めるようになる。',
    pros: ['未解決の失敗を放置せず潰せる', isProgress ? '自動実行基盤(progress)の信頼性が上がる' : '対象アプリの不具合が解消される'],
    cons: ['失敗原因が環境/外部要因なら再発しうる', '原因調査に時間がかかる場合がある'],
  }
}

function nextActionToCandidate(item: { text: string; app: string }): ProposeGoalInput {
  const isProgress = item.app === PROGRESS_APP
  return {
    title: item.text.slice(0, 80),
    summary: `直近の自動実行が次アクションとして挙げた未消化項目（targetApp=${item.app}）。`,
    metric: 'progress',
    target: 100,
    current: 0,
    priority: isProgress ? 'P1' : 'P2',
    rationale: `過去 Run の nextActions に挙がったまま着手されていない項目。試した方がいいこととしてゴール化。`,
    source: 'app_improvement',
    enables: 'やり残しの次アクションが正式なゴールとして承認・実行対象になる。',
    pros: ['自動実行が自分で挙げた改善が埋もれない', '承認するだけで次の自動実行対象になる'],
    cons: ['nextAction の粒度がゴールとして大きすぎ/小さすぎる場合がある'],
  }
}

/**
 * 使用状況(usage-log)から「運用上あると便利な機能」の提案候補を作る。
 * - よく開く画面（hot）→ その画面の操作を速くする便利機能を提案（試した方がいいこと）
 * - 登録済みだが直近この窓で1度も開かれていない画面（放置）→ 導線見直し/統廃合を提案（運用改善）
 * progress 自身の使われ方を一次データにするため、候補は progress アプリ扱い（priority やや高め）。
 */
async function collectUsageSignals(): Promise<ProposeGoalInput[]> {
  const out: ProposeGoalInput[] = []
  let summary
  try {
    summary = await buildUsageSummary(USAGE_RANGE_DAYS)
  } catch {
    return out // usage-log 読めない/未蓄積でも他シグナルで進める
  }
  if (!summary.hasData) return out

  // 1. よく開く画面（最上位）を便利機能の提案にする
  const hot = summary.screens.find((s) => s.count >= HOT_SCREEN_MIN_VIEWS)
  if (hot) {
    out.push({
      title: `よく開く画面「${hot.label}」の操作を速くする便利機能を足す`,
      summary: `直近${USAGE_RANGE_DAYS}日で${hot.count}回開かれている主要画面。よく使う操作をショートカット/まとめ表示で短縮できないか検討する。`,
      metric: 'progress',
      target: 100,
      current: 0,
      priority: 'P1',
      rationale: `usage-log の集計で「${hot.label}」(${hot.href}) が直近${USAGE_RANGE_DAYS}日に${hot.count}回と最も多く開かれている。使用状況から導いた便利機能の候補。`,
      source: 'usage_signal',
      enables: 'よく使う画面の操作回数/移動を減らし、毎日の運用が速くなる。',
      pros: ['実データ（使用状況）に基づく改善', '効果が体感しやすい中心画面が対象'],
      cons: ['「便利」の具体化に設計判断が要る', '使い方が変わると陳腐化しうる'],
    })
  }

  // 2. 放置画面（登録済みだが直近窓で未アクセス）を運用改善の提案にする
  const unused = summary.unusedScreens[0]
  if (unused) {
    out.push({
      title: `使われていない画面「${unused.label}」の導線を見直す`,
      summary: `登録済みだが直近${USAGE_RANGE_DAYS}日に1度も開かれていない画面。発見性の改善（導線追加）か、不要なら統廃合を検討する。`,
      metric: 'progress',
      target: 100,
      current: 0,
      priority: 'P2',
      rationale: `usage-log の放置検知で「${unused.label}」(${unused.href}) が直近${USAGE_RANGE_DAYS}日に未アクセス。使用状況から導いた運用改善の候補。`,
      source: 'usage_signal',
      enables: '使われていない画面を改善 or 整理でき、ナビの見通しが良くなる。',
      pros: ['放置画面を放置しない', '統廃合すれば保守対象が減る'],
      cons: ['未アクセス=不要とは限らない（用途が季節性の場合あり）'],
    })
  }

  return out
}

export interface ImprovementProposalResult {
  proposed: boolean
  reason: string
  created: ProposeGoalsResult['created']
  pendingCount: number
  /** 候補がどのシグナルから来たかの内訳（ログ用）。 */
  bySource: { failures: number; nextActions: number; usage: number; seeds: number }
}

/**
 * 自動実行対象が無いアイドル時に呼ぶ。承認待ち(proposed)が上限未満なら、
 * progress 優先で「改善事項」「試した方がいいこと」をゴール候補(status='proposed')として登録する。
 * 1・2 のシグナルが無くても seed で必ず1件以上を埋め、「次の自動実行が空」を回避する。
 */
export async function proposeImprovementGoalsIfIdle(): Promise<ImprovementProposalResult> {
  const goals = await readGoals()
  const pending = goals.goals.filter((g) => g.status === 'proposed').length
  const bySource = { failures: 0, nextActions: 0, usage: 0, seeds: 0 }
  if (pending >= MAX_PENDING_PROPOSALS) {
    return {
      proposed: false,
      reason: `承認待ちのゴール提案が${pending}件あるため新規提案しない（先に Inbox で承認/却下）`,
      created: [],
      pendingCount: pending,
      bySource,
    }
  }

  const fill = MAX_PENDING_PROPOSALS - pending
  const existingTitles = new Set(goals.goals.map((g) => g.title.trim()))
  const runs = (await readExecutionRuns()).slice(0, SCAN_RUNS)

  const candidates: ProposeGoalInput[] = []
  const pushUnique = (c: ProposeGoalInput, key: keyof typeof bySource): boolean => {
    const t = c.title.trim()
    if (!t || existingTitles.has(t) || candidates.some((x) => x.title.trim() === t)) return false
    candidates.push(c)
    bySource[key] += 1
    return true
  }

  // 1. 失敗の解消（改善事項・progress 優先）
  for (const f of collectUnresolvedFailures(runs)) {
    if (candidates.length >= fill) break
    pushUnique(failureToCandidate(f), 'failures')
  }
  // 2. 未消化 nextActions（試した方がいいこと）
  for (const item of collectNextActions(runs)) {
    if (candidates.length >= fill) break
    pushUnique(nextActionToCandidate(item), 'nextActions')
  }
  // 3. 使用状況シグナル（よく使う画面の便利機能 / 放置画面の運用改善）
  for (const c of await collectUsageSignals()) {
    if (candidates.length >= fill) break
    pushUnique(c, 'usage')
  }
  // 4. seed フォールバック（空回避の保険）
  for (const seed of PROGRESS_IMPROVEMENT_SEEDS) {
    if (candidates.length >= fill) break
    pushUnique(seed, 'seeds')
  }

  if (candidates.length === 0) {
    return {
      proposed: false,
      reason: '新規の改善候補が見つからなかった（既存ゴールと重複/枠不足）',
      created: [],
      pendingCount: pending,
      bySource,
    }
  }

  const result = await proposeGoals(candidates, { source: 'app_improvement' })
  return {
    proposed: result.created.length > 0,
    reason: `アイドル時の改善提案を${result.created.length}件登録（失敗解消=${bySource.failures}/次アクション=${bySource.nextActions}/使用状況=${bySource.usage}/seed=${bySource.seeds}・承認後に自動実行対象）`,
    created: result.created,
    pendingCount: pending + result.created.length,
    bySource,
  }
}
