import { readJson } from '@/lib/store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readAppProgress, readProjectTasks } from '@/lib/progress-reader'
import { getAutomationConfig, getEpics, getPendingApprovals } from '@/lib/operations-store'
import { computeFactoryMetrics, type FactoryMetrics } from '@/lib/factory-metrics'
import { readGoals } from '@/lib/goal-reader'
import type { InboxCardKind } from '@/lib/inbox-labels'
import type { RecommendedEpic } from '@/types/recommended-epic'
import type { ExecutionRun } from '@/types/execution-run'

// 新UX（人間用司令塔）のビューモデル。内部の専門用語をここで人間語に翻訳し、
// 画面側には翻訳済みの文言だけを渡す。新しい正本は作らない（既存データからの都度算出）。

// ---- 用語翻訳（内部語 → 人間語）----
export const TERMS: Record<string, { ja: string; help: string }> = {
  goal: { ja: '目標', help: '会社として目指す方向。すべての作業はどれかの目標に紐付きます' },
  epic: { ja: '大きな作業', help: '1つのまとまった作業単位。AIが小さく分けて進めます' },
  knowledge: { ja: '学習結果', help: '終わった作業から取り出した学び。次の作業候補のもとになります' },
  executionRun: { ja: '作業履歴', help: 'AIが行った1回の作業の記録' },
  factory: { ja: 'AI工場', help: '安全な作業をAIが自動で進める仕組み' },
  suggestedEpic: { ja: 'おすすめ次作業', help: 'AIが提案する次にやるとよい作業。承認すると開始されます' },
  closedLoopRate: { ja: '自動化率', help: 'AIが人間の介入なしで作業を完了し、学習結果まで残せた割合' },
  notReviewed: { ja: '未確認の作業履歴', help: 'AIの作業結果のうち、まだ内容確認が済んでいないもの。たまっても工場は止まりません（参考情報）' },
  needsHuman: { ja: 'あなたの判断待ち', help: 'AIだけでは決められず、人間の判断を待っている項目' },
  inbox: { ja: '今日の判断', help: '工場が止まる原因（危険判断・方針選択・人間作業）だけが入る判断箱。最大3件・約3分。処理すると工場が動き出します' },
  aiHold: { ja: 'AI保留', help: '人間が判断する必要のないもの（AIレビュー・候補整理・定期実行・重複・内容不足）をAIが預かっている状態。件数だけ表示します' },
  acceptance: { ja: '検収', help: 'AIの作業が終わったので、結果だけ見て「問題なし/修正する」を選ぶ判断' },
  permission: { ja: '実行許可', help: 'AIがやりたい作業を「進める/やめる」で許可する判断' },
  direction: { ja: '方針選択', help: 'AIでは決められない方向性（目標・優先順位）を社長が選ぶ判断' },
  humanTask: { ja: '人間作業', help: 'ストア登録・課金設定・契約など、AIでは実行できない作業' },
  dangerJudge: { ja: '危険判断', help: '本番データ・課金・認証など、影響が大きい操作の許可。社長判断必須' },
}

export interface TodayAction {
  title: string
  detail: string
  href?: string
  kind: 'judge' | 'ai' | 'user_work'
}

export interface FactoryStateView {
  /** 例: 稼働中（毎日自動実行） / 一時減速中 / 停止候補 */
  statusLabel: string
  statusTone: 'ok' | 'warn' | 'alert'
  description: string
  automationRatePct: number
  notReviewedCount: number
  lastResultText: string
  lastErrorText: string | null
}

export interface Milestone {
  label: string
  state: 'done' | 'current' | 'todo'
  note: string
}

export interface RecentWin {
  date: string
  app: string
  title: string
}

export interface CommandCenterView {
  todayActions: TodayAction[]
  /** 今日の判断（工場停止要因のみ・最大3件）の見出しリスト。ホームの「今日やること」カードに出す */
  todayDecisions: Array<{ kind: InboxCardKind; headline: string }>
  decisionCount: number
  /** 参考情報（放置しても工場は止まらない）: レビュー / Epic候補 / AI保留 の件数 */
  reviewTotal: number
  candidateTotal: number
  aiHoldCount: number
  estimatedMinutes: number
  factory: FactoryStateView
  milestones: Milestone[]
  recentWins: RecentWin[]
  metrics: FactoryMetrics
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function buildFactoryState(metrics: FactoryMetrics, factoryEnabled: boolean): FactoryStateView {
  const level = metrics.backpressure.level
  let statusLabel = '稼働中（毎日自動実行）'
  let statusTone: FactoryStateView['statusTone'] = 'ok'
  let description = 'AIが安全な作業を自動で進めています。'
  if (!factoryEnabled) {
    statusLabel = '停止中'
    statusTone = 'alert'
    description = 'AI工場はオフになっています。再開は旧画面の「自動化」から行えます。'
  } else if (level === 'pause') {
    statusLabel = '停止中（あなたの判断待ち）'
    statusTone = 'alert'
    description =
      metrics.blockers.dangerApprovalCount > 0
        ? `危険判断待ちが${metrics.blockers.dangerApprovalCount}件あるため、許可が出るまで自動作業を止めています。Inboxの「今日の判断」で許可・不許可を選んでください。`
        : `対象の大きな作業がすべて目標未設定（${metrics.blockers.goalUnsetEpicCount}件）のため止まっています。Inboxで目標を紐付けてください。`
  }
  // レビュー件数では止めない（2026-06-11 運用方針変更）。レビューはたまっていても稼働を続ける。
  return {
    statusLabel,
    statusTone,
    description,
    automationRatePct: Math.round(metrics.closedLoopRate * 1000) / 10,
    notReviewedCount: metrics.notReviewedCount,
    lastResultText: metrics.factoryLastResult ? `直近の自動作業: ${metrics.factoryLastResult}` : '直近の自動作業はありません',
    lastErrorText: metrics.factoryLastError ? `気になる結果: ${metrics.factoryLastError}` : null,
  }
}

/** 収益化マイルストーン（現状データからの目安判定）。 */
export async function buildRevenueMilestones(): Promise<Milestone[]> {
  const [epics, recommendations] = await Promise.all([
    getEpics(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
  ])
  const birdlogMvp = epics.find((e) => /birdlog/i.test(`${e.epicId} ${e.title}`) && /MVP/i.test(e.title))
  const publishRec = recommendations.find((r) => /birdlog/i.test(`${r.id} ${r.title}`) && /公開申請/.test(r.title))
  const adsRec = recommendations.find((r) => /birdlog/i.test(`${r.id} ${r.title}`) && /(課金|AdMob)/i.test(r.title))

  const mvpDone = birdlogMvp?.status === 'done'
  const publishStarted = publishRec?.status === 'epic_created'

  const steps: Milestone[] = [
    {
      label: 'BirdLog アプリを完成させる',
      state: mvpDone ? 'done' : 'current',
      note: birdlogMvp
        ? mvpDone ? '完成済み' : 'AIが製作中（自動作業の対象）'
        : '対象の作業が見つかりません',
    },
    {
      label: 'ストアに公開申請する（あなたの作業）',
      state: mvpDone ? 'current' : 'todo',
      note: publishStarted ? '進行中' : 'Google Play / App Store の申請。アカウント準備が必要',
    },
    {
      label: '広告・課金を設定する（あなたの作業）',
      state: 'todo',
      note: adsRec ? 'AdMob などの設定。公開後に実施' : '公開後に実施',
    },
    { label: 'ダウンロード100件', state: 'todo', note: 'ストア公開後に計測を開始' },
    { label: 'はじめての収益 1円', state: 'todo', note: 'ここがゴール。以降は拡大フェーズ' },
  ]
  return steps
}

const HIDDEN_WIN_PATTERN = /Factory schedule|定期取り込み/

export async function buildCommandCenter(): Promise<CommandCenterView> {
  const [metrics, inbox, config, runs, milestones, tasksData] = await Promise.all([
    computeFactoryMetrics(),
    buildInbox(),
    getAutomationConfig(),
    readExecutionRuns(),
    buildRevenueMilestones(),
    readProjectTasks(),
  ])

  const factory = buildFactoryState(metrics, config.factoryEnabled)

  // 今日やること: ①判断（今日の判断はtodayDecisionsで個別表示） ②AIに任せる確認 ③あなたの番の作業
  const todayActions: TodayAction[] = []
  if (metrics.notReviewedCount > 0) {
    todayActions.push({
      kind: 'ai',
      title: `AIにまとめて確認させる（残り${metrics.notReviewedCount}件）`,
      detail: '未確認の作業履歴をAIが仕分けします。あなたはボタンを押すだけです',
      href: '/decide#ai-check',
    })
  }
  const userTodo = tasksData.projects
    .flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.projectId })))
    .find((t) => t.assignee === 'user' && !['done', 'skipped', 'deleted'].includes(t.status))
  if (userTodo) {
    todayActions.push({
      kind: 'user_work',
      title: 'あなたの番の作業が1件あります',
      detail: `${userTodo.projectId}: ${userTodo.title}`,
      href: '/portfolio',
    })
  }
  if (todayActions.length === 0 && inbox.decisions.length === 0) {
    todayActions.push({ kind: 'judge', title: '今日は判断事項がありません', detail: 'AI工場が自動で進めています。Projectsで進み具合だけ確認できます', href: '/portfolio' })
  }

  const recentWins: RecentWin[] = runs
    .filter((r) => r.runStatus === 'completed' && !HIDDEN_WIN_PATTERN.test(r.targetTodoTitle))
    .slice(0, 5)
    .map((r) => ({ date: fmtDate(r.finishedAt || r.startedAt), app: r.targetApp, title: r.targetTodoTitle || r.summary }))

  return {
    todayActions,
    todayDecisions: inbox.decisions.map((c) => ({ kind: c.kind, headline: c.headline })),
    decisionCount: inbox.decisions.length,
    reviewTotal: inbox.reviewTotal,
    candidateTotal: inbox.candidateTotal,
    aiHoldCount: inbox.aiHoldCount,
    estimatedMinutes: inbox.estimatedMinutes,
    factory,
    milestones,
    recentWins,
    metrics,
  }
}

// ---- 今日の判断（社長向け意思決定カード・6分類）----
// 分類は「何の種類のタスクか」ではなく「人間が何を判断するのか」:
//   検収 / 実行許可 / 方針選択 / 人間作業 / 危険判断 / AI保留（非表示・件数のみ）
// 内部概念（ExecutionRun / runId / reviewed / suggested / Factory schedule 等）は
// 通常表示に出さず、「詳細を見る」の中にのみ置く。

const CATEGORY_LABEL: Record<string, string> = {
  billing: '課金の判断',
  external_publish: '公開の判断',
  secret: '認証・秘密情報の判断',
  production_risk: '本番データの判断',
  destructive: '危険な操作の判断',
  goal_change: '目標の判断',
  monetization: '収益化の判断',
  multi_option: '作業内容の確認',
  executor_fallback: '進め方の判断',
}

/** 危険判断に回す承認カテゴリ（本番・課金・認証・破壊的・公開）。 */
const DANGER_CATEGORIES = new Set(['billing', 'secret', 'production_risk', 'destructive', 'deploy', 'external_publish'])

export { KIND_CHIP_LABEL } from '@/lib/inbox-labels'
export type { InboxCardKind } from '@/lib/inbox-labels'

export interface InboxCardAction {
  label: string
  tone: 'primary' | 'ghost' | 'danger'
  /** null のときは「あとで」= 今日は見ない（画面から閉じるだけ。状態は変えない） */
  api: { url: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> } | null
}

/** カード本文の「ラベル: 説明」行（放置すると / AIがやること / 人間がやること 等）。 */
export interface InboxCardRow {
  label: string
  text: string
}

export interface InboxCard {
  id: string
  kind: InboxCardKind
  /** 何が起きているか（状況文）。内部語禁止 */
  headline: string
  /** 本文の説明行。内部語禁止 */
  rows: InboxCardRow[]
  /** 末尾の問いかけ */
  question?: string
  /** 「詳細を見る」内にだけ出す説明（元タイトル・内部ID・AI判断理由・変換理由可） */
  detail: string[]
  actions: InboxCardAction[]
  /** kind === 'direction'（Goal紐付け）のときの選択肢 */
  goals?: Array<{ id: string; title: string }>
  epicId?: string
}

/**
 * Inbox の画面ビュー（4セクション構成・2026-06-11 運用方針変更）。
 * ① 今日の判断 = 工場停止要因のみ（危険判断 / 方針選択 / 人間作業）。最大3件
 * ② レビュー = 検収。放置しても工場は止まらない
 * ③ Epic候補 = 実行許可（改善案・次Epic・収益化候補）。放置可能
 * ④ AI保留 = 件数のみ表示（カードは出さない）
 */
export interface InboxView {
  decisions: InboxCard[]
  decisionTotal: number
  reviews: InboxCard[]
  reviewTotal: number
  candidates: InboxCard[]
  candidateTotal: number
  aiHoldCount: number
  estimatedMinutes: number
}

/** 内部の命名規則（Run一次レビュー: / epic-xxx / 次Epic候補 / Run / Factory 等）をタイトルから除く・人間語へ置換する。 */
function humanizeTitle(title: string): string {
  let t = title
  // 「レビュー起点: おすすめ承認: レビュー起点: …」のような入れ子プレフィックスは安定するまで剥がす
  const prefixes = /^(Run一次レビュー|レビュー起点|おすすめ承認|Epic完了|epic[-_][\w-]+|Factory\(auto\))\s*[:：]\s*/i
  for (let i = 0; i < 6 && prefixes.test(t); i++) t = t.replace(prefixes, '')
  const patterns: Array<[RegExp, string]> = [
    // 「… の次Epic候補（既存Epicへ Next Action 追記） の次Epic候補 …」以降はすべてメタ情報
    [/\s*の次Epic候補[\s\S]*$/i, ''],
    [/\s*\((schedule|boot)\/[^)]*\)/gi, ''],
    // 内部IDはどこにあっても除去
    [/epic[-_][\w-]+[-_]?\s*/gi, ''],
    // 内部語の翻訳
    [/Factory\s*schedule/gi, 'AI工場の定期実行'],
    [/Factory/gi, 'AI工場'],
    [/失敗\s*Run/gi, '失敗した作業'],
    [/\bRuns?\b/g, '作業'],
    [/\bReview\b/gi, 'レビュー'],
  ]
  for (const [re, rep] of patterns) t = t.replace(re, rep)
  t = t.replace(/（\s*）|\(\s*\)/g, '').replace(/\s{2,}/g, ' ')
  t = t.trim().replace(/^[、。・:：\s]+/, '').replace(/[、。\s]+$/, '')
  const wrapped = t.match(/^（(.+)）$/) ?? t.match(/^\((.+)\)$/)
  if (wrapped) t = wrapped[1].trim()
  return t || title
}

/** タスク名から「何の話か」の主語を取り出す（補足括弧と末尾の作業動詞を落とす）。 */
function subjectOf(clean: string): string {
  let s = clean.replace(/（[^）]*）|\([^)]*\)/g, '').trim()
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/(を|の)?(調査・修正|調査|修正|対応|改修|確認|改善|追加|実装|整備|を作る|作成)(する)?$/, '')
      .replace(/（[^）]*）$|\([^)]*\)$/, '')
      .replace(/[、。・\s]+$/, '')
      .trim()
  }
  return s || clean
}

function shorten(s: string, n = 26): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/** ドメイン語から「放置するとどうなるか」を推定する。 */
function impactOfProblem(text: string): string {
  if (/市場調査/.test(text)) return '毎日の市場調査結果が更新されません。'
  if (/ニュース/.test(text)) return 'ニュース要約が止まります。'
  if (/(更新|同期)/.test(text)) return 'データが古いまま更新されません。'
  if (/(公開|デプロイ|反映)/.test(text)) return '最新の内容が公開されないままになります。'
  return 'この部分が止まったままになります。'
}

function impactOfImprove(text: string): string {
  if (/(自動化|自動)/.test(text)) return '手作業が減ります。'
  if (/(精度|品質)/.test(text)) return '結果の品質が上がります。'
  if (/(調査|分析)/.test(text)) return '次の打ち手が明確になります。'
  if (/(取り込み|収集|データ)/.test(text)) return '使えるデータが増えます。'
  return '品質が上がり、手作業が減ります。'
}

/** AI保留（人間に見せない）対象かどうか。定期実行・ヘルスチェック・内容不足など。 */
function isAiHoldTitle(rawTitle: string): boolean {
  if (/Factory\s*schedule|health\s*check|routine|定期取り込み|定期実行|metrics/i.test(rawTitle)) return true
  // 「レビュー起点: おすすめ承認: レビュー起点: …」のような入れ子2回以上のメタ候補は
  // 既存候補から再帰生成された重複であり、AIだけで判断可能 → 人間に見せない
  if ((rawTitle.match(/レビュー起点[:：]/g) ?? []).length >= 2) return true
  const clean = humanizeTitle(rawTitle)
  if (subjectOf(clean).length < 4) return true // 内容不足（runIdだけ等）
  return false
}

/** 人間作業（AIでは実行できない）かどうか。ストア公開・課金・契約・認証系。 */
function isHumanTaskTitle(rawTitle: string): boolean {
  return /（ユーザー作業）|\(ユーザー作業\)|公開申請|ストア公開|AdMob|課金|サブスク|API契約|本人確認|アカウント登録|ログイン設定|認証情報/.test(rawTitle)
}

interface Situation {
  isProblem: boolean
  headline: string
  noLeaveAlone: string // 放置すると:
  aiWill: string // AIがやること:
}

/**
 * タスク名（何をやるか）を状況文（何が起きているか）へ変換する。
 * 例: 「市場調査ビューのVault更新停止を調査・修正」→「市場調査ビューの自動更新が止まっています」
 */
function describeSituation(title: string): Situation {
  const clean = humanizeTitle(title)
  const subject = subjectOf(clean)

  if (/(停止|止ま|失敗|エラー|不具合|障害|落ち|ダウン)/.test(clean)) {
    const isUpdate = /(更新|同期|反映)/.test(clean)
    const isFactoryFail = /AI工場.*失敗|失敗.*AI工場/.test(clean)
    const what = subject
      .replace(/(の)?(Vault)?(日次)?(更新|同期|反映|連携)*(不具合|停止|エラー|失敗|障害)(の解消)?$/, '')
      .replace(/(の)?失敗(した)?作業$/, '')
      .replace(/[、。・の\s]+$/, '')
      .trim()
    return {
      isProblem: true,
      headline: isFactoryFail
        ? 'AI工場の自動作業が失敗しています'
        : isUpdate
          ? `${shorten(what) || 'データ'}の自動更新が止まっています`
          : `${shorten(what) || 'AIの作業'}で問題が起きています`,
      noLeaveAlone: isFactoryFail ? '自動作業が進まないままになります。' : impactOfProblem(clean),
      aiWill: `${shorten(subject, 30) || 'この問題'}を調査して修正します。`,
    }
  }

  return {
    isProblem: false,
    headline: `${shorten(subject)}を改善できます`,
    noLeaveAlone: '現状のままでも動きますが、改善の機会を逃します。',
    aiWill: `${shorten(subject, 30)}を実施します。実施すると${impactOfImprove(clean)}`,
    }
}

/** 今日見せる上限。社長アプリとして「3件・約3分」を超えない。 */
const TODAY_LIMIT = 3

/** 同じテーマの大量候補をAI保留に回すためのテーマキー。 */
function themeKeyOf(rawTitle: string): string | null {
  if (/MVP を作る|MVPを作る/.test(rawTitle)) return 'mvp'
  if (/公開申請/.test(rawTitle)) return 'store-publish'
  if (/AdMob|課金\/サブスク/.test(rawTitle)) return 'monetize-setup'
  return null
}

export async function buildInbox(): Promise<InboxView> {
  const [approvals, epics, recommendations, runs, goalsData] = await Promise.all([
    getPendingApprovals(),
    getEpics(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
    readExecutionRuns(),
    readGoals(),
  ])
  const goals = goalsData.goals.map((g) => ({ id: g.id, title: g.title }))
  const cards: InboxCard[] = []
  let heldCount = 0

  // ① 承認待ち → 危険判断 / 検収 / 方針選択
  for (const a of approvals) {
    const isReviewDecision = a.options.some((o) => /問題なし|フォローアップ/.test(o.label))
    const clean = humanizeTitle(a.title)
    const detail = [
      `元タイトル: ${a.title}`,
      `判断の種類: ${CATEGORY_LABEL[a.category] ?? a.category}`,
      `AI判断理由: ${a.reason}`,
      ...(a.createdRunId ? [`元の作業履歴: ${a.createdRunId}`] : []),
      `内部ID: ${a.approvalId}`,
    ]
    const findOption = (re: RegExp) => a.options.find((o) => re.test(o.label))
    const approveApi = (key: string) =>
      ({ url: '/api/operations/approvals', method: 'POST', body: { approvalId: a.approvalId, decidedOption: key } }) as const

    if (isReviewDecision) {
      // 検収: AIの作業が終わった。結果だけ確認する
      const ok = findOption(/問題なし/) ?? a.options[0]
      const fix = findOption(/フォローアップ|修正|再試行/)
      const hold = findOption(/保留|あとで/)
      cards.push({
        id: `approval-${a.approvalId}`,
        kind: 'acceptance',
        headline: `「${shorten(subjectOf(clean))}」の作業が完了しました`,
        rows: [
          { label: 'AIがやったこと', text: `${shorten(clean, 40)}。` },
          { label: '人間がやること', text: '結果を見るだけ。' },
        ],
        question: '確認してください。問題ありませんか？',
        detail,
        actions: [
          { label: '問題なし', tone: 'primary', api: approveApi(ok.key) },
          ...(fix ? [{ label: '修正する', tone: 'danger' as const, api: approveApi(fix.key) }] : []),
          { label: 'あとで', tone: 'ghost', api: hold ? approveApi(hold.key) : null },
        ],
      })
    } else if (DANGER_CATEGORIES.has(a.category)) {
      // 危険判断: 実行すると影響が大きい。社長判断必須
      const yes = a.options.find((o) => o.key === a.recommended) ?? a.options[0]
      const no = findOption(/却下|見送|やめる|中止|しない/) ?? a.options.find((o) => o.key !== yes.key)
      cards.push({
        id: `approval-${a.approvalId}`,
        kind: 'danger',
        headline: `「${shorten(subjectOf(clean))}」を実行しようとしています`,
        rows: [{ label: '影響', text: `${CATEGORY_LABEL[a.category] ?? '影響の大きい操作'}です。実行すると元に戻せない可能性があります。` }],
        question: '許可しますか？',
        detail,
        actions: [
          { label: '許可する', tone: 'primary', api: approveApi(yes.key) },
          ...(no ? [{ label: '許可しない', tone: 'danger' as const, api: approveApi(no.key) }] : []),
        ],
      })
    } else {
      // 方針選択: AIでは決められない方向性の判断
      cards.push({
        id: `approval-${a.approvalId}`,
        kind: 'direction',
        headline: `「${shorten(subjectOf(clean))}」について判断してください`,
        rows: [{ label: '選ばないと', text: 'AIはこの作業を進められず、止まったままになります。' }],
        detail,
        actions: a.options.map((o) => ({
          label: o.label.replace(/（[^）]*）|\([^)]*\)/g, '').trim(),
          tone: o.key === a.recommended ? ('primary' as const) : ('ghost' as const),
          api: approveApi(o.key),
        })),
      })
    }
  }

  // ② AIが判断を保留した作業結果 → 検収
  const approvalRunIds = new Set(approvals.map((a) => a.createdRunId).filter(Boolean))
  for (const run of runs.filter((r) => r.reviewStatus === 'needs_human' && !approvalRunIds.has(r.runId))) {
    const raw = run.targetTodoTitle || run.summary || ''
    if (!raw || isAiHoldTitle(raw)) {
      heldCount += 1
      continue
    }
    const clean = humanizeTitle(raw)
    const isPublish = /(公開|デプロイ|Vercel|反映)/i.test(clean)
    cards.push({
      id: `run-${run.runId}`,
      kind: 'acceptance',
      headline: isPublish ? '公開作業が完了しました' : `「${shorten(subjectOf(clean))}」の作業が完了しました`,
      rows: [
        { label: 'AIがやったこと', text: `${shorten(clean, 40)}。` },
        { label: '人間がやること', text: isPublish ? '正常に表示されているか見るだけ。' : '結果を見るだけ。' },
      ],
      question: isPublish ? '正常に表示されていますか？' : '確認してください。問題ありませんか？',
      detail: [
        `元タイトル: ${raw}`,
        `AI判断理由: ${run.aiReview?.reason ?? 'AIだけでは判断できなかった作業結果です'}`,
        `元の作業履歴: ${run.runId}`,
      ],
      actions: [
        { label: '問題なし', tone: 'primary', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'reviewed' } } },
        { label: '修正する', tone: 'danger', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'needs_followup' } } },
        { label: 'あとで', tone: 'ghost', api: null },
      ],
    })
  }

  // ③ 目標未紐付けの大きな作業 → 方針選択（Goalをボタンで選ぶ）
  const openStatuses = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
  for (const epic of epics.filter((e) => openStatuses.has(e.status) && !e.goalId)) {
    cards.push({
      id: `orphan-${epic.epicId}`,
      kind: 'direction',
      headline: `「${shorten(humanizeTitle(epic.title))}」の目的が決まっていません`,
      rows: [{ label: '選ばないと', text: 'この作業がどの目標に貢献しているか追跡できません。' }],
      question: 'この作業はどの目標に近いですか？',
      detail: [`元タイトル: ${epic.title}`, `内部ID: ${epic.epicId}`, '不要な作業は「不要」で取り下げられます'],
      actions: [],
      goals,
      epicId: epic.epicId,
    })
  }

  // ④ おすすめ次作業 → 実行許可 / 人間作業（定期実行・重複・同テーマ大量はAI保留）
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 }
  const suggested = recommendations
    .filter((r) => r.status === 'suggested')
    .sort((a, b) => {
      const p = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
      if (p !== 0) return p
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
  const seenThemes = new Set<string>()
  for (const rec of suggested) {
    // AI保留: 定期実行・内容不足・重複・同テーマの大量候補
    const theme = themeKeyOf(rec.title)
    if (isAiHoldTitle(rec.title) || rec.duplicate?.duplicate || (theme && seenThemes.has(theme))) {
      heldCount += 1
      continue
    }
    if (theme) seenThemes.add(theme)

    const detail = [
      `元タイトル: ${rec.title}`,
      `AI判断理由: ${rec.reason}`,
      ...(rec.sourceRunId ? [`元の作業履歴: ${rec.sourceRunId}`] : []),
      ...(rec.sourceRef ? [`提案の出どころ: ${rec.sourceRef}`] : []),
      `内部ID: ${rec.id}`,
    ]
    const holdApi = { url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'hold', detail: '今日の判断で「あとで」を選択' } } as const
    const rejectApi = (note: string) =>
      ({ url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'rejected', detail: note } }) as const

    if (isHumanTaskTitle(rec.title)) {
      // 人間作業: AIでは実行できない（ストア公開・課金・契約など）
      const clean = humanizeTitle(rec.title)
      cards.push({
        id: `candidate-${rec.id}`,
        kind: 'human_task',
        headline: `「${shorten(subjectOf(clean))}」はあなたの作業が必要です`,
        rows: [
          { label: '内容', text: `${shorten(clean, 40)}。` },
          { label: '注意', text: 'アカウント登録・契約・審査などを含むため、AIでは実行できません。' },
        ],
        detail,
        actions: [
          { label: '完了した', tone: 'primary', api: rejectApi('人間作業として完了済み（今日の判断で報告）') },
          { label: 'あとで', tone: 'ghost', api: holdApi },
          { label: '不要', tone: 'danger', api: rejectApi('今日の判断で「不要」を選択') },
        ],
      })
    } else {
      // 実行許可: AIが作業したい。やって良いかだけ聞く
      const s = describeSituation(rec.title)
      cards.push({
        id: `candidate-${rec.id}`,
        kind: 'permission',
        headline: s.headline,
        rows: [
          { label: '放置すると', text: s.noLeaveAlone },
          { label: 'AIがやること', text: s.aiWill },
          { label: '人間がやること', text: '進めるか選ぶだけ。' },
        ],
        question: s.isProblem ? 'AIが調査して修正しますか？' : 'AIに任せますか？',
        detail,
        actions: [
          { label: '進める', tone: 'primary', api: { url: `/api/recommended-epics/${rec.id}/approve`, method: 'POST', body: {} } },
          { label: 'あとで', tone: 'ghost', api: holdApi },
          { label: 'やめる', tone: 'danger', api: rejectApi('今日の判断で「やめる」を選択') },
        ],
      })
    }
  }

  // 4セクションへ振り分け（2026-06-11 運用方針変更）:
  // ① 今日の判断 = 工場停止要因のみ（危険判断 → 方針選択 → 人間作業 の優先順・最大3件）
  // ② レビュー = 検収（放置しても工場は止まらない） ③ Epic候補 = 実行許可（放置可能） ④ AI保留 = 件数のみ
  const stopOrder: Record<string, number> = { danger: 0, direction: 1, human_task: 2 }
  const stopFactors = cards
    .filter((c) => c.kind === 'danger' || c.kind === 'direction' || c.kind === 'human_task')
    .sort((a, b) => (stopOrder[a.kind] ?? 9) - (stopOrder[b.kind] ?? 9))
  const reviews = cards.filter((c) => c.kind === 'acceptance')
  const candidates = cards.filter((c) => c.kind === 'permission')
  const decisions = stopFactors.slice(0, TODAY_LIMIT)

  return {
    decisions,
    decisionTotal: stopFactors.length,
    reviews,
    reviewTotal: reviews.length,
    candidates,
    candidateTotal: candidates.length,
    aiHoldCount: heldCount,
    estimatedMinutes: Math.max(decisions.length, 1),
  }
}

// ---- Projects（ポートフォリオ）----

export interface ProjectCard {
  id: string
  name: string
  statusLabel: string
  statusTone: 'ok' | 'warn' | 'wait' | 'done'
  nextWork: string
  updatedAt: string
  monetizationLabel: string
}

const PROJECT_STATUS_LABEL: Record<string, { label: string; tone: ProjectCard['statusTone'] }> = {
  in_progress: { label: '進行中', tone: 'ok' },
  active: { label: '待機中', tone: 'wait' },
  user_action_pending: { label: 'あなたの作業待ち', tone: 'warn' },
  deploy_ready: { label: '公開準備OK', tone: 'warn' },
  done: { label: '完了', tone: 'done' },
}

const EPIC_STATUS_LABEL: Record<string, { label: string; tone: ProjectCard['statusTone'] }> = {
  active: { label: 'AIが製作中', tone: 'ok' },
  approved: { label: '開始待ち', tone: 'wait' },
  proposed: { label: '提案中', tone: 'wait' },
  paused: { label: '一時停止', tone: 'warn' },
  blocked: { label: '停止中（要対応）', tone: 'warn' },
  done: { label: '完了', tone: 'done' },
}

interface MonetizationCandidateLite {
  id?: string
  name?: string
  targetApp?: string
  status?: string
}

const MONETIZATION_LABEL: Record<string, string> = {
  Draft: '検討中',
  Candidate: '収益化候補',
  EpicCreated: '収益化作業中',
}

export async function buildProjectPortfolio(): Promise<ProjectCard[]> {
  const [progressData, epics, runs, candidates] = await Promise.all([
    readAppProgress(),
    getEpics(),
    readExecutionRuns(),
    readJson<MonetizationCandidateLite[]>('monetization-candidates.json', []),
  ])

  function monetizationFor(key: string): string {
    const hit = candidates.find((c) => {
      const t = `${c.id ?? ''} ${c.name ?? ''} ${c.targetApp ?? ''}`.toLowerCase()
      return key && t.includes(key.toLowerCase())
    })
    return hit?.status ? (MONETIZATION_LABEL[hit.status] ?? hit.status) : '—'
  }

  function latestRunFor(app: string): ExecutionRun | undefined {
    return runs.find((r) => r.targetApp === app)
  }

  const cards: ProjectCard[] = []
  const seen = new Set<string>()

  // 1) AI工場で動いている大きな作業（active / approved Epic）をプロジェクトとして出す
  for (const epic of epics.filter((e) => ['active', 'approved', 'blocked', 'paused'].includes(e.status))) {
    const app = epic.targetApps?.[0] ?? epic.epicId
    if (seen.has(app)) continue
    seen.add(app)
    const st = EPIC_STATUS_LABEL[epic.status] ?? { label: epic.status, tone: 'wait' as const }
    const run = latestRunFor(app)
    cards.push({
      id: app,
      name: app === 'progress' ? 'Progress（このアプリ）' : app,
      statusLabel: st.label,
      statusTone: st.tone,
      nextWork: epic.nextAction || epic.title,
      updatedAt: run?.finishedAt || epic.updatedAt,
      monetizationLabel: monetizationFor(app),
    })
  }

  // 2) 既存案件（app-progress.json）のうち動きがあるもの
  for (const p of progressData.projects) {
    if (seen.has(p.id)) continue
    if (!['in_progress', 'user_action_pending', 'deploy_ready'].includes(p.status)) continue
    seen.add(p.id)
    const st = PROJECT_STATUS_LABEL[p.status] ?? { label: p.status, tone: 'wait' as const }
    cards.push({
      id: p.id,
      name: p.name,
      statusLabel: st.label,
      statusTone: st.tone,
      nextWork: p.nextAction || p.currentTask || '次の作業未設定',
      updatedAt: p.updatedAt,
      monetizationLabel: monetizationFor(p.id) !== '—' ? monetizationFor(p.id) : monetizationFor(p.name),
    })
  }

  return cards.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}
