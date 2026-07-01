import { readProjectTasks } from '@/lib/progress-reader'
import { getAutomationConfig } from '@/lib/operations-store'
import { computeFactoryMetrics, type FactoryMetrics } from '@/lib/factory-metrics'
import { calcGoalProgress, goalAchievement } from '@/lib/goal-reader'
import { getAutoQueueView } from '@/lib/auto-queue'
import type { InboxCardKind } from '@/lib/inbox-labels'
import { humanizeTitle, subjectOf, shorten } from '@/lib/humanize'
import { formatRevenueJpy } from '@/lib/revenue-config'
import { checkDataHealth, type DataHealthSummary } from '@/lib/data-health'
import {
  readPageAppProgress,
  readPageEpics,
  readPageExecutionRuns,
  readPageGoals,
  readPageMonetizationCandidates,
  readPagePendingApprovals,
  readPageProjectTasks,
  readPageRecommendations,
  readPageRevenueConfig,
} from '@/lib/page-data-cache'
import {
  buildFactoryOutlook,
  buildFixRequests,
  type FactoryOutlook,
  type FixRequestView,
} from '@/lib/factory-outlook'
import type { ExecutionRun, ReviewStatus } from '@/types/execution-run'
import type { Goal } from '@/types/goal'
import type { Project, Task } from '@/types/progress'
import type { Epic } from '@/lib/types/operations'

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
  inbox: { ja: '今日の判断', help: '工場が止まる原因（危険判断・方針選択・人間作業）だけが入る判断箱。最大5件・約5分。処理すると工場が動き出します' },
  aiHold: { ja: 'AI保留', help: '人間が判断する必要のないもの（AIレビュー・候補整理・定期実行・重複・内容不足）をAIが預かっている状態。件数だけ表示します' },
  acceptance: { ja: '検収', help: 'AIの作業が終わったので、結果だけ見て「問題なし/修正する」を選ぶ判断' },
  permission: { ja: '実行許可', help: 'AIがやりたい作業を「進める/やめる」で許可する判断' },
  direction: { ja: '方針選択', help: 'AIでは決められない方向性（目標・優先順位）を社長が選ぶ判断' },
  humanTask: { ja: '人間作業', help: 'ストア登録・課金設定・契約など、AIでは実行できない作業' },
  dangerJudge: { ja: '危険判断', help: '本番データ・課金・認証など、影響が大きい操作の許可。社長判断必須' },
  fixRequest: { ja: '修正依頼', help: 'AIの作業結果に直してほしい点がある状態。AI工場の次作業候補へ自動で戻します' },
  expiredCandidate: { ja: '期限切れ候補', help: '30日以上動かなかったおすすめ次作業。削除せずAI保留に移し、必要なら再表示できます' },
  revenueConfig: { ja: '収益設定', help: '収益化の対象アプリ・現在収益・マイルストーンを決める設定です' },
  dataHealth: { ja: 'データ整合', help: '存在しない目標や作業への参照、古い修正依頼、残留した実行中表示を確認する点検です' },
  requestCache: { ja: '画面内キャッシュ', help: '同じ画面表示中だけ読み取り結果を使い回し、APIの更新処理には影響させない仕組みです' },
  runArchive: { ja: '作業履歴アーカイブ', help: '古い確認済みの作業履歴をバックアップ後に月別ファイルへ移す整理です' },
  reviewCopy: { ja: 'レビュー用コピー', help: '司令塔の現在状態をMarkdownにまとめ、ChatGPTやFableへ貼って外部レビューを受けるための読み取り専用コピーです' },
  verifyTodo: { ja: '動作確認Todo', help: 'AIの作業やEpic完了後に、人間が確認すべき画面・URL・手順を一覧で管理する場所。未確認/確認済/NG/保留で状態を管理し、アプリ・Epic・状態で絞り込めます' },
  loopHealth: { ja: 'ループの健全性', help: '「実行→レビュー→学び(Knowledge)→次のEpic候補」の流れが切れていないかを測る指標。自動実行画面のカードで🟢=全段つながり済み/🟡=こぼれ件数を表示し、こぼれは「自己修復」で冪等に補完できます（表示・補完専用で工場の実行順は変えません）' },
  goalStepEpic: { ja: '達成まで自動で進める（次の一歩）', help: 'ToDoも大きな作業も無い未達成の目標を、AI工場が「達成まで自動で進める」対象として自動実行キューに載せます。工場が拾うと、その目標を進める次の1ステップ（次の一歩）を大きな作業として自動で作り、達成するまで繰り返します。承認待ち・手動方針・危険操作の目標は対象外です' },
  usage: { ja: '使用状況', help: 'Progress 自身の使われ方を集計する画面（/usage）。どの画面をよく開き・どのボタンをよく押し・最後にいつ使い・どの画面を放置しているかを直近7日で表示します。画面遷移とボタン操作を自動で記録（usage-log.ndjson）した表示専用の集計で、AI工場の判定や実行には影響しません' },
  proposedGoal: { ja: 'ゴール承認', help: 'AI が「次に目指すべきゴール」を提案します（status=proposed）。提案元は2系統で、①自動実行の最初に日々の調査結果（ニュース）から、②自動実行する作業が無くなったアイドル時に progress 自身の改善事項・試したいこと（ゴール生成モード）から補充します。提案ゴールは今日の判断（Inbox）の「ゴール承認」に並び、承認すると次回以降の自動実行で達成まで自動で進めます。やめると候補から外れます。承認するまで自動実行はされません' },
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

export interface RecentResearch {
  date: string
  candidateId: string
  candidateName: string
  summary: string
}

export interface FactoryStopAlert {
  days: number
  reason: string
}

export interface CommandCenterView {
  todayActions: TodayAction[]
  /** 今日の判断（工場停止要因のみ・最大5件）の見出しリスト。ホームの「今日やること」カードに出す */
  todayDecisions: Array<{ kind: InboxCardKind; headline: string }>
  decisionCount: number
  /** 参考情報（放置しても工場は止まらない）: レビュー / Epic候補 / AI保留 の件数 */
  reviewTotal: number
  candidateTotal: number
  aiHoldCount: number
  estimatedMinutes: number
  factory: FactoryStateView
  factoryStopAlert: FactoryStopAlert | null
  dataHealth: DataHealthSummary
  factoryOutlook: FactoryOutlook
  fixRequests: FixRequestView
  milestones: Milestone[]
  currentRevenueText: string
  aiHoldBreakdown: Array<{ label: string; count: number }>
  projectProgress: ProjectProgressCard[]
  goalProgress: GoalProgressCard[]
  recentWins: RecentWin[]
  recentResearch: RecentResearch[]
  metrics: FactoryMetrics
}

function fmtDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

/** 「2026/06/13 13:02」形式の完了日時。レビューカードの完了表示に使う。 */
function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** ExecutionRun の「完了日時」として最も妥当な ISO を選ぶ（finishedAt → startedAt の順）。
 *  reviewedAt はレビュー操作日時であり作業完了日時ではないため完了表示には使わない。 */
function runCompletedAt(run: ExecutionRun): string {
  return run.finishedAt || run.startedAt || ''
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

async function buildFactoryStopAlert(metrics: FactoryMetrics, factoryEnabled: boolean): Promise<FactoryStopAlert | null> {
  if (!factoryEnabled || metrics.backpressure.level !== 'pause') return null
  const nowMs = Date.now()
  if (metrics.blockers.dangerApprovalCount > 0) {
    const approvals = await readPagePendingApprovals()
    const danger = approvals
      .filter((a) => DANGER_CATEGORIES.has(a.category))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0]
    const started = Date.parse(danger?.createdAt ?? new Date().toISOString())
    return {
      days: Math.max(0, Math.floor((nowMs - started) / 86_400_000)),
      reason: '危険判断待ちがあります',
    }
  }
  if (metrics.blockers.goalUnsetEpicCount > 0) {
    const epics = await readPageEpics()
    const unset = epics
      .filter((e) => ['approved', 'active'].includes(e.status) && !e.goalId)
      .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))[0]
    const started = Date.parse(unset?.updatedAt ?? new Date().toISOString())
    return {
      days: Math.max(0, Math.floor((nowMs - started) / 86_400_000)),
      reason: 'すべての対象作業で目標が未設定です',
    }
  }
  return null
}

/** 収益化マイルストーン（現状データからの目安判定）。 */
export async function buildRevenueMilestones(): Promise<Milestone[]> {
  const [epics, recommendations, revenueConfig] = await Promise.all([
    readPageEpics(),
    readPageRecommendations(),
    readPageRevenueConfig(),
  ])
  const focus = revenueConfig.focusApp.toLowerCase()
  const matchesFocus = (value: string) => value.toLowerCase().includes(focus)
  const mvpEpic = epics.find((e) => matchesFocus(`${e.epicId} ${e.title} ${(e.targetApps ?? []).join(' ')}`) && /MVP/i.test(e.title))
  const publishRec = recommendations.find((r) => matchesFocus(`${r.id} ${r.title} ${r.targetApp ?? ''}`) && /公開申請/.test(r.title))
  const adsRec = recommendations.find((r) => matchesFocus(`${r.id} ${r.title} ${r.targetApp ?? ''}`) && /(課金|AdMob)/i.test(r.title))

  const mvpDone = mvpEpic?.status === 'done'
  const publishStarted = publishRec?.status === 'epic_created'

  return revenueConfig.milestones.map((milestone) => {
    if (milestone.kind === 'mvp') {
      return {
        label: milestone.label,
        state: mvpDone ? 'done' : 'current',
        note: milestone.note ?? (mvpEpic ? mvpDone ? '完成済み' : 'AIが製作中（自動作業の対象）' : '対象の作業が見つかりません'),
      }
    }
    if (milestone.kind === 'publish') {
      return {
        label: milestone.label,
        state: mvpDone ? 'current' : 'todo',
        note: milestone.note ?? (publishStarted ? '進行中' : 'Google Play / App Store の申請。アカウント準備が必要'),
      }
    }
    if (milestone.kind === 'monetization_setup') {
      return {
        label: milestone.label,
        state: 'todo',
        note: milestone.note ?? (adsRec ? 'AdMob などの設定。公開後に実施' : '公開後に実施'),
      }
    }
    return {
      label: milestone.label,
      state: milestone.state ?? 'todo',
      note: milestone.note ?? '',
    }
  })
}

const HIDDEN_WIN_PATTERN = /Factory schedule|定期取り込み/

export async function buildCommandCenter(): Promise<CommandCenterView> {
  const [metrics, inbox, config, runs, candidates, milestones, revenueConfig, tasksData, factoryOutlook, fixRequests, projectProgress, goalProgress, dataHealth] = await Promise.all([
    computeFactoryMetrics(),
    buildInbox(),
    getAutomationConfig(),
    readPageExecutionRuns(),
    readPageMonetizationCandidates(),
    buildRevenueMilestones(),
    readPageRevenueConfig(),
    readPageProjectTasks(),
    buildFactoryOutlook(),
    buildFixRequests(),
    buildProjectProgressCards(),
    buildGoalProgressCards(),
    checkDataHealth(),
  ])

  const factory = buildFactoryState(metrics, config.factoryEnabled)
  const factoryStopAlert = await buildFactoryStopAlert(metrics, config.factoryEnabled)

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

  const recentResearch: RecentResearch[] = candidates
    .flatMap((candidate) =>
      (candidate.researchLogs ?? []).map((log) => ({
        date: log.date,
        candidateId: candidate.id,
        candidateName: candidate.name,
        summary: log.summary || log.note,
      })),
    )
    .filter((item) => item.date && item.summary)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, 3)
    .map((item) => ({ ...item, date: fmtDate(item.date) }))

  return {
    todayActions,
    todayDecisions: inbox.decisions.map((c) => ({ kind: c.kind, headline: c.headline })),
    decisionCount: inbox.decisions.length,
    reviewTotal: inbox.reviewTotal,
    candidateTotal: inbox.candidateTotal,
    aiHoldCount: inbox.aiHoldCount,
    estimatedMinutes: inbox.estimatedMinutes,
    factory,
    factoryStopAlert,
    dataHealth,
    factoryOutlook,
    fixRequests,
    milestones,
    currentRevenueText: formatRevenueJpy(revenueConfig.currentRevenueJpy),
    aiHoldBreakdown: inbox.aiHoldBreakdown,
    projectProgress,
    goalProgress,
    recentWins,
    recentResearch,
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
  /** 画面遷移だけのアクション。api より優先してリンク表示する。 */
  href?: string
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
  /** 画面フィルタ用のGoal。変換レイヤーで付与し、正本データは変更しない。 */
  goalId?: string
  goalTitle?: string
  /** 画面フィルタ用のプロジェクト（targetApp）。変換レイヤーで付与し、正本データは変更しない。 */
  projectId?: string
  projectTitle?: string
  /** レビュー用コピーの元になる ExecutionRun。レビュータブの正本リンク。 */
  sourceRunId?: string
  /** 完了日時の ISO（finishedAt → startedAt）。レビューカードで「完了: YYYY/MM/DD HH:mm」表示・並び替えに使う。 */
  completedAt?: string
  /** 完了日時の表示用文字列（「2026/06/13 13:02」）。 */
  completedAtText?: string
  /** レビュー状態。バッジ表示（未確認/あとで/要修正/レビュー済み）と一覧フィルタに使う。 */
  reviewStatus?: ReviewStatus
  /** 人間が「修正する」で入力した修正指示。次回作業候補へ渡す。 */
  fixPrompt?: string
  /** AIが needs_human と判断して人間判断へ上げた一次レビュー承認。今日の判断に出す。 */
  escalated?: boolean
  /** 何が起きているか（状況文）。内部語禁止 */
  headline: string
  /** 本文の説明行。内部語禁止 */
  rows: InboxCardRow[]
  /** 末尾の問いかけ */
  question?: string
  /** 「詳細を見る」内にだけ出す説明（元タイトル・内部ID・AI判断理由・変換理由可） */
  detail: string[]
  actions: InboxCardAction[]
  /** kind === 'direction'（Goal紐付け）/ permission（承認時Goal指定）のときの選択肢 */
  goals?: Array<{ id: string; title: string }>
  epicId?: string
  /** ゴール承認カードのカテゴリ。'try'=試した方がいい系（調査由来）/ 'app'=アプリ系（progress改善）。サブタブ分けに使う。 */
  proposalCategory?: 'try' | 'app'
  /** ゴール承認カードの提案元。サブタブ分けと起因表示に使う。 */
  proposalSource?: string
  /** ゴール承認カードの提案時刻。無い場合は updatedAt 由来の推定時刻を入れる。 */
  proposedAt?: string
  /** proposedAt が未記録で updatedAt にフォールバックしたかどうか。 */
  proposedAtEstimated?: boolean
  proposalSourceLabel?: string
  proposedAtText?: string
}

/** 提案元(proposalSource)から承認カードのカテゴリを決める。調査由来=試した方がいい系、それ以外=アプリ系。 */
export function proposalCategoryOf(source?: string): 'try' | 'app' {
  return source === 'research' ? 'try' : 'app'
}

export function proposalSourceLabelOf(source?: string): string {
  if (source === 'research') return '日々の調査'
  if (source === 'app_improvement' || source === 'factory_idle_improvement') return 'アプリ改善'
  if (source === 'vision_followup') return 'ビジョン追従'
  if (source === 'origin_gap') return '方針ギャップ'
  if (source === 'manual') return '自分で追加'
  return 'AI'
}

export interface InboxGoalSummary {
  goalId: string
  goalTitle: string
  today: number
  reviews: number
  followup: number
  snoozed: number
  reviewed: number
  aiHold: number
  candidates: number
}

/** プロジェクト（targetApp）単位のInbox件数。cards から派生する画面フィルタ用集計。 */
export interface InboxProjectSummary {
  projectId: string
  projectTitle: string
  today: number
  reviews: number
  candidates: number
  aiHold: number
}

/**
 * Inbox の画面ビュー（4セクション構成・2026-06-11 運用方針変更）。
 * ① 今日の判断 = 工場停止要因のみ（危険判断 / 方針選択 / 人間作業）。最大5件
 * ② レビュー = 検収。放置しても工場は止まらない
 * ③ Epic候補 = 実行許可（改善案・次Epic・収益化候補）。放置可能
 * ④ AI保留 = 件数のみ表示（カードは出さない）
 */
export interface InboxView {
  decisions: InboxCard[]
  decisionTotal: number
  /** 達成済みゴール（done または current >= target）。ゴール達成確認タブの派生フィルタに使う。 */
  achievedGoalIds: string[]
  /** レビュー待ち（未確認/あとで/要修正）の全件。completedAt 降順。隠さず全件返す。 */
  reviews: InboxCard[]
  reviewTotal: number
  /** レビュー状態別の件数サマリー（一覧上部に表示）。 */
  reviewCounts: { unconfirmed: number; followup: number; snoozed: number }
  /** レビュー済み履歴（reviewed）。物理削除せず後から参照する。completedAt 降順・直近分。 */
  reviewedHistory: InboxCard[]
  /** レビュー済みの総件数（reviewedHistory が上限で切られていても総数は保持）。 */
  reviewedTotal: number
  candidates: InboxCard[]
  candidateTotal: number
  aiHoldCount: number
  /** AI保留の理由別内訳（件数のみ・降順）。例: 重複・同テーマ候補 12 / 定期処理 4 */
  aiHoldBreakdown: Array<{ label: string; count: number }>
  /** 自動実行中にAIが提案したゴール候補（status='proposed'）。承認で自動実行対象になる。capしない。 */
  proposedGoals: InboxCard[]
  /** 自動実行（Factory）の最近の作業履歴。Inboxで「何が自動で動いたか」を把握する（情報表示）。 */
  autoRuns: InboxCard[]
  /** Goal単位のInbox件数。cardsとAI保留カウントから同じbuildInbox内で生成する派生集計。 */
  goalSummaries: InboxGoalSummary[]
  /** プロジェクト（targetApp）単位のInbox件数。Goalと同じソースから生成する派生集計。 */
  projectSummaries: InboxProjectSummary[]
  estimatedMinutes: number
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

/** AI保留（人間に見せない）の理由。null なら保留対象外。理由ラベルは内訳表示にそのまま使う。 */
function aiHoldReason(rawTitle: string): string | null {
  if (/Factory\s*schedule|health\s*check|routine|定期取り込み|定期実行|metrics/i.test(rawTitle)) return '定期処理'
  // 「レビュー起点: おすすめ承認: レビュー起点: …」のような入れ子2回以上のメタ候補は
  // 既存候補から再帰生成された重複であり、AIだけで判断可能 → 人間に見せない
  if ((rawTitle.match(/レビュー起点[:：]/g) ?? []).length >= 2) return '重複・同テーマ候補'
  const clean = humanizeTitle(rawTitle)
  if (subjectOf(clean).length < 4) return '内容不足' // runIdだけ等
  return null
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

/** 今日見せる上限。社長アプリとして「5件・約5分」を超えない。 */
const TODAY_LIMIT = 5
const REVIEW_NUDGE_THRESHOLD = 5
const STUCK_GOAL_LIMIT = 2

/** 同じテーマの大量候補をAI保留に回すためのテーマキー。 */
function themeKeyOf(rawTitle: string): string | null {
  if (/MVP を作る|MVPを作る/.test(rawTitle)) return 'mvp'
  if (/公開申請/.test(rawTitle)) return 'store-publish'
  if (/AdMob|課金\/サブスク/.test(rawTitle)) return 'monetize-setup'
  return null
}

export async function buildInbox(): Promise<InboxView> {
  const [approvals, epics, recommendations, runs, goalsData, autoQueue, appProgress] = await Promise.all([
    readPagePendingApprovals(),
    readPageEpics(),
    readPageRecommendations(),
    readPageExecutionRuns(),
    readPageGoals(),
    getAutoQueueView(),
    readPageAppProgress(),
  ])
  const goals = goalsData.goals.map((g) => ({ id: g.id, title: g.title }))
  const achievedGoalIds = Array.from(new Set(
    goalsData.goals
      .filter((goal) => (
        goal.status === 'done'
        || (
          typeof goal.target === 'number'
          && goal.target > 0
          && typeof goal.current === 'number'
          && goal.current >= goal.target
        )
      ))
      .map((goal) => goal.id),
  ))
  const goalTitleById = new Map(goalsData.goals.map((g) => [g.id, g.title]))
  const goalById = new Map(goalsData.goals.map((g) => [g.id, g]))
  const epicById = new Map(epics.map((epic) => [epic.epicId, epic]))
  const runById = new Map(runs.map((run) => [run.runId, run]))
  const projectTitleById = new Map(appProgress.projects.map((project) => [project.id, project.name]))
  const unassignedGoal = { goalId: 'unassigned', goalTitle: '未紐づけ' }
  const goalMeta = (goalId?: string | null) => {
    if (!goalId) return unassignedGoal
    return { goalId, goalTitle: goalTitleById.get(goalId) ?? (goalId === 'unassigned' ? '未紐づけ' : goalId) }
  }
  const goalFromTargetApp = (targetApp?: string) => {
    const goal = targetApp ? goalsData.goals.find((g) => sameApp(g.projectId ?? '', targetApp)) : undefined
    return goalMeta(goal?.id)
  }
  const goalForRun = (run?: ExecutionRun) => {
    if (!run) return unassignedGoal
    const epic = run.epicId ? epicById.get(run.epicId) : undefined
    if (epic?.goalId) return goalMeta(epic.goalId)
    return goalFromTargetApp(run.targetApp)
  }
  const goalForApproval = (approval: (typeof approvals)[number]) => {
    const epic = approval.epicId ? epicById.get(approval.epicId) : undefined
    if (epic?.goalId) return goalMeta(epic.goalId)
    if (approval.createdRunId) return goalForRun(runById.get(approval.createdRunId))
    return unassignedGoal
  }
  const goalForRecommendation = (rec: (typeof recommendations)[number]) => {
    if (rec.goalId) return goalMeta(rec.goalId)
    const epicId = rec.parentEpicId ?? rec.relatedEpicId
    const epic = epicId ? epicById.get(epicId) : undefined
    if (epic?.goalId) return goalMeta(epic.goalId)
    if (rec.sourceRunId) return goalForRun(runById.get(rec.sourceRunId))
    if (rec.followupOfRunId) return goalForRun(runById.get(rec.followupOfRunId))
    return goalFromTargetApp(rec.targetApp)
  }
  // プロジェクト（targetApp）単位の画面フィルタ用メタ。Goalと同じく変換レイヤーで付与する。
  const unassignedProject = { projectId: 'unassigned', projectTitle: '未分類' }
  const projectMeta = (app?: string | null) => {
    const key = app?.trim()
    if (!key) return unassignedProject
    return { projectId: key, projectTitle: projectTitleById.get(key) ?? key }
  }
  const projectForEpic = (epic?: (typeof epics)[number]) =>
    projectMeta(epic?.targetApps?.[0] ?? epic?.targetApp)
  const projectForRun = (run?: ExecutionRun) => (run ? projectMeta(run.targetApp) : unassignedProject)
  const projectForApproval = (approval: (typeof approvals)[number]) => {
    if (approval.projectId) return projectMeta(approval.projectId)
    const epic = approval.epicId ? epicById.get(approval.epicId) : undefined
    const fromEpic = projectForEpic(epic)
    if (fromEpic.projectId !== 'unassigned') return fromEpic
    if (epic?.goalId) {
      const fromGoal = projectMeta(goalById.get(epic.goalId)?.projectId)
      if (fromGoal.projectId !== 'unassigned') return fromGoal
    }
    if (approval.createdRunId) return projectForRun(runById.get(approval.createdRunId))
    return unassignedProject
  }
  const projectForRecommendation = (rec: (typeof recommendations)[number]) => {
    if (rec.targetApp) return projectMeta(rec.targetApp)
    const epicId = rec.parentEpicId ?? rec.relatedEpicId
    const epic = epicId ? epicById.get(epicId) : undefined
    const fromEpic = projectForEpic(epic)
    if (fromEpic.projectId !== 'unassigned') return fromEpic
    if (rec.sourceRunId) return projectForRun(runById.get(rec.sourceRunId))
    if (rec.followupOfRunId) return projectForRun(runById.get(rec.followupOfRunId))
    return unassignedProject
  }
  const cards: InboxCard[] = []
  let heldCount = 0
  const heldBy: Record<string, number> = {}
  const heldByGoal: Record<string, number> = {}
  const heldByProject: Record<string, number> = {}
  const hold = (reason: string, goalId = 'unassigned', projectId = 'unassigned') => {
    heldCount += 1
    heldBy[reason] = (heldBy[reason] ?? 0) + 1
    heldByGoal[goalId] = (heldByGoal[goalId] ?? 0) + 1
    heldByProject[projectId] = (heldByProject[projectId] ?? 0) + 1
  }
  for (const rec of recommendations.filter((r) => r.status === 'expired')) {
    hold('期限切れ', goalForRecommendation(rec).goalId, projectForRecommendation(rec).projectId)
  }

  for (const goal of goalsData.goals.filter((g) => g.status === 'active')) {
    for (const todo of goal.todos) {
      if (todo.role !== 'human') continue
      if (todo.status === 'done' || todo.status === 'skipped') continue
      cards.push({
        id: `human-todo-${goal.id}-${todo.id}`,
        kind: 'human_task',
        goalId: goal.id,
        goalTitle: goal.title,
        ...projectMeta(goal.projectId),
        headline: `あなたの作業: ${todo.title}`,
        rows: [
          { label: 'ゴール', text: goal.title },
        ],
        question: 'これはAIではできない、あなたが手を動かす作業です。終わったら印を付けてください。',
        detail: [
          `goalId: ${goal.id}`,
          `todoId: ${todo.id}`,
          `状態: ${todo.status}`,
          ...(todo.nextAction ? [`次の一手: ${todo.nextAction}`] : []),
        ],
        actions: [
          { label: '完了', tone: 'primary', api: { url: '/api/goals', method: 'POST', body: { action: 'updateTodo', goalId: goal.id, todoId: todo.id, updates: { status: 'done' } } } },
          { label: 'あとで', tone: 'ghost', api: null },
        ],
      })
    }
  }

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
        escalated: true,
        ...goalForApproval(a),
        ...projectForApproval(a),
        sourceRunId: a.createdRunId,
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
        ...goalForApproval(a),
        ...projectForApproval(a),
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
      // 何の選択肢かが常に見えるよう、実際の質問(question)と判断内容/理由(rows)を折りたたまず表示する。
      const questionText = a.title.includes(':') ? a.title.slice(a.title.indexOf(':') + 1).trim() : clean
      const rows: InboxCardRow[] = [{ label: '判断内容', text: a.title }]
      if (a.reason && a.reason.trim()) rows.push({ label: '理由', text: a.reason })
      rows.push({ label: '選ばないと', text: 'AIはこの作業を進められず、止まったままになります。' })
      cards.push({
        id: `approval-${a.approvalId}`,
        kind: 'direction',
        ...goalForApproval(a),
        ...projectForApproval(a),
        headline: `「${shorten(subjectOf(clean))}」について判断してください`,
        rows,
        question: questionText,
        detail,
        actions: a.options.map((o) => ({
          label: o.label.replace(/（[^）]*）|\([^)]*\)/g, '').trim(),
          tone: o.key === a.recommended ? ('primary' as const) : ('ghost' as const),
          api: approveApi(o.key),
        })),
      })
    }
  }

  // ② レビュー（検収）: AIの作業結果を人間が確認する正本リスト。隠さず全件出す。
  //   状態遷移: 未確認 →[問題なし]reviewed（消込・履歴へ）/[修正する]needs_followup（要修正で残置）/[あとで]snoozed（後回しで残置）。
  const approvalRunIds = new Set(approvals.map((a) => a.createdRunId).filter(Boolean))

  // レビュー状態に応じた操作ボタン（操作後の状態遷移を整理）。
  function reviewActionsFor(run: ExecutionRun): InboxCardAction[] {
    const url = `/api/execution-runs/${run.runId}`
    const ok: InboxCardAction = { label: '問題なし', tone: 'primary', api: { url, method: 'PATCH', body: { reviewStatus: 'reviewed' } } }
    const fix: InboxCardAction = { label: '修正する', tone: 'danger', api: { url, method: 'PATCH', body: { reviewStatus: 'needs_followup' } } }
    const later: InboxCardAction = { label: 'あとで', tone: 'ghost', api: { url, method: 'PATCH', body: { reviewStatus: 'snoozed' } } }
    const back: InboxCardAction = { label: '未確認に戻す', tone: 'ghost', api: { url, method: 'PATCH', body: { reviewStatus: 'not_reviewed' } } }
    if (run.reviewStatus === 'needs_followup') return [ok, back] // 要修正 →[問題なし]対応済み /[未確認に戻す]
    if (run.reviewStatus === 'snoozed') return [ok, fix, back] // あとで →[問題なし]/[修正する]/[未確認に戻す]
    return [ok, fix, later] // 未確認（needs_human / not_reviewed / copied）
  }

  function buildReviewCard(run: ExecutionRun): InboxCard {
    const raw = run.targetTodoTitle || run.summary || ''
    const clean = humanizeTitle(raw)
    const isPublish = /(公開|デプロイ|Vercel|反映)/i.test(clean)
    const completedAt = runCompletedAt(run)
    const fixPromptPreview = run.fixPrompt ? shorten(run.fixPrompt, 120) : ''
    return {
      id: `run-${run.runId}`,
      kind: 'acceptance',
      ...goalForRun(run),
      ...projectForRun(run),
      sourceRunId: run.runId,
      completedAt,
      completedAtText: fmtDateTime(completedAt),
      reviewStatus: run.reviewStatus,
      headline: isPublish ? '公開作業が完了しました' : `「${shorten(subjectOf(clean))}」の作業が完了しました`,
      rows: [
        { label: 'AIがやったこと', text: `${shorten(run.summary || clean, 48)}。` },
        { label: '人間がやること', text: isPublish ? '正常に表示されているか見るだけ。' : 'レビュー用コピーで内容を確認する。' },
        ...(fixPromptPreview ? [{ label: '修正指示', text: fixPromptPreview }] : []),
      ],
      question: isPublish ? '正常に表示されていますか？' : '確認してください。問題ありませんか？',
      detail: [
        `元タイトル: ${raw}`,
        `状態: ${run.runStatus} / ${run.reviewStatus}`,
        ...(run.aiReview?.reason ? [`AI判断理由: ${run.aiReview.reason}`] : []),
        `完了日時: ${fmtDateTime(completedAt) || '不明'}`,
        `元の作業履歴: ${run.runId}`,
        ...(run.fixPrompt ? [`修正指示: ${run.fixPrompt}`] : []),
      ],
      actions: reviewActionsFor(run),
      fixPrompt: run.fixPrompt,
    }
  }

  // 自動状態（needs_human / not_reviewed / copied）は内容不足・定期処理なら AI保留へ振り分ける（既存挙動）。
  const AUTO_REVIEW_STATES = new Set<ReviewStatus>(['needs_human', 'not_reviewed', 'copied'])
  for (const run of runs.filter((r) => AUTO_REVIEW_STATES.has(r.reviewStatus) && !approvalRunIds.has(r.runId))) {
    const raw = run.targetTodoTitle || run.summary || ''
    const runHold = !raw ? '内容不足' : aiHoldReason(raw)
    if (runHold) {
      hold(runHold === '定期処理' ? '定期処理' : 'レビュー整理', goalForRun(run).goalId, projectForRun(run).projectId)
      continue
    }
    cards.push(buildReviewCard(run))
  }
  // 人間が状態を決めたもの（あとで / 要修正）は AI保留へ流さず、常にレビュー一覧に残す。
  const HUMAN_REVIEW_STATES = new Set<ReviewStatus>(['snoozed', 'needs_followup'])
  for (const run of runs.filter((r) => HUMAN_REVIEW_STATES.has(r.reviewStatus) && !approvalRunIds.has(r.runId))) {
    cards.push(buildReviewCard(run))
  }

  // レビュー済み履歴（reviewed）。物理削除しないので後から参照できる。直近200件・completedAt降順。
  const REVIEWED_HISTORY_LIMIT = 200
  const reviewedRuns = runs.filter((r) => r.reviewStatus === 'reviewed' && !approvalRunIds.has(r.runId))
  const reviewedHistory: InboxCard[] = reviewedRuns
    .slice()
    .sort((a, b) => runCompletedAt(b).localeCompare(runCompletedAt(a)))
    .slice(0, REVIEWED_HISTORY_LIMIT)
    .map((run) => {
      const card = buildReviewCard(run)
      // 履歴カードは消し込みの取り消し（未確認に戻す）だけ。
      card.actions = [{ label: '未確認に戻す', tone: 'ghost', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'not_reviewed' } } }]
      return card
    })

  // ③ 目標未紐付けの大きな作業 → 方針選択（Goalをボタンで選ぶ）
  const openStatuses = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
  for (const epic of epics.filter((e) => openStatuses.has(e.status) && !e.goalId)) {
    cards.push({
      id: `orphan-${epic.epicId}`,
      kind: 'direction',
      ...unassignedGoal,
      ...projectForEpic(epic),
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
    const recHold =
      aiHoldReason(rec.title) ?? (rec.duplicate?.duplicate || (theme && seenThemes.has(theme)) ? '重複・同テーマ候補' : null)
    if (recHold) {
      hold(recHold, goalForRecommendation(rec).goalId, projectForRecommendation(rec).projectId)
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
      // 人間作業（アカウント登録・ストア公開申請・課金/サブスク・AdMob 等）は今日の判断に出さない。
      // どのアプリでも未実施の手続きであり時期尚早のため、AI保留として預かる（2026-06-12 ユーザー指示）。
      // 実際に必要になったタイミング（例: BirdLog MVP 完成後）は Revenue の収益化ロードマップで案内する。
      hold('時期尚早の人間作業', goalForRecommendation(rec).goalId, projectForRecommendation(rec).projectId)
    } else {
      // 実行許可: AIが作業したい。やって良いかだけ聞く
      const s = describeSituation(rec.title)
      cards.push({
        id: `candidate-${rec.id}`,
        kind: 'permission',
        ...goalForRecommendation(rec),
        ...projectForRecommendation(rec),
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
        goals,
      })
    }
  }

  const activeGoalIds = new Set(goalsData.goals.filter((goal) => goal.status === 'active').map((goal) => goal.id))
  const goalsById = new Map(goalsData.goals.map((goal) => [goal.id, goal]))
  const directionGoalIds = new Set(
    cards
      .filter((card) => (card.kind === 'danger' || card.kind === 'direction') && card.goalId)
      .map((card) => card.goalId as string),
  )
  const stuckGoalRows = autoQueue.goalProgress
    .filter((row) => {
      const goal = goalsById.get(row.goalId)
      if (!goal || !activeGoalIds.has(row.goalId) || directionGoalIds.has(row.goalId)) return false
      const hasOpenTodo = goal.todos.some((todo) => todo.status !== 'done' && todo.status !== 'skipped')
      return hasOpenTodo && row.executable === 0
    })
    .slice(0, STUCK_GOAL_LIMIT)
  for (const row of stuckGoalRows) {
    const goal = goalsById.get(row.goalId)
    if (!goal) continue
    cards.push({
      id: `stuck-goal-${goal.id}`,
      kind: 'direction',
      goalId: goal.id,
      goalTitle: goal.title,
      ...projectMeta(goal.projectId),
      headline: `「${goal.title}」が止まっています`,
      rows: [
        { label: '状況', text: '未完了の作業があるのに自動実行候補に入っていません。原因解消が必要です。' },
      ],
      question: '原因を確認しますか？',
      detail: [
        `goalId: ${goal.id}`,
        `実行可能候補: ${row.executable}`,
        `待機: user=${row.waitingUser} aiHold=${row.aiHold} review=${row.reviewWaiting} blocked=${row.blocked} manual=${row.manual}`,
      ],
      actions: [
        { label: '詳細を見る', tone: 'primary', href: `/goal-dashboard?goalId=${encodeURIComponent(goal.id)}`, api: null },
        { label: 'あとで', tone: 'ghost', api: null },
      ],
    })
  }

  // 4セクションへ振り分け（2026-06-11 運用方針変更）:
  // ① 今日の判断 = 工場停止要因のみ（危険判断 → 方針選択 → 人間作業 の優先順・最大5件）
  // ② レビュー = 検収（放置しても工場は止まらない） ③ Epic候補 = 実行許可（放置可能） ④ AI保留 = 件数のみ
  const stopOrder: Record<string, number> = { danger: 0, direction: 1, human_task: 2 }
  // 自動実行中にAIが提案したゴール候補（承認すると次回以降の自動実行対象になる）。capしない。
  const proposedGoals: InboxCard[] = goalsData.goals
    .filter((g) => g.status === 'proposed')
    .sort((a, b) => (b.proposedAt ?? b.updatedAt ?? '').localeCompare(a.proposedAt ?? a.updatedAt ?? ''))
    .map((g) => {
      const enables = g.proposalEnables || g.summary || g.description || ''
      const pros = (g.proposalPros && g.proposalPros.length > 0)
        ? g.proposalPros
        : ['目標として明示され、AI工場が達成まで自動で進められる']
      const cons = (g.proposalCons && g.proposalCons.length > 0)
        ? g.proposalCons
        : ['承認すると自動実行の対象が増える（他の優先作業の時間を一部使う）']
      const sourceLabel = proposalSourceLabelOf(g.proposalSource)
      const proposedAt = g.proposedAt ?? g.updatedAt
      const proposedAtEstimated = !g.proposedAt && Boolean(g.updatedAt)
      const proposedAtText = proposedAt ? `${fmtDateTime(proposedAt)}${proposedAtEstimated ? ' (推定)' : ''}` : undefined
      return {
        id: `goal-approval-${g.id}`,
        kind: 'direction' as const,
        goalId: g.id,
        goalTitle: g.title,
        proposalCategory: proposalCategoryOf(g.proposalSource),
        proposalSource: g.proposalSource,
        proposedAt,
        proposedAtEstimated,
        proposalSourceLabel: sourceLabel,
        proposedAtText,
        headline: `ゴール候補: ${g.title}`,
        rows: [
          { label: '追加日時', text: proposedAtText ?? '不明' },
          { label: '起因', text: sourceLabel },
          ...(enables ? [{ label: '✅ できるようになること', text: enables }] : []),
          { label: '👍 メリット', text: pros.map((p) => `・${p}`).join('\n') },
          { label: '👎 デメリット・注意', text: cons.map((c) => `・${c}`).join('\n') },
          { label: '承認すると', text: '次回以降の自動実行の対象になり、このゴールを達成まで自動で進めます（次の一歩を自動でEpic化）。' },
          { label: 'やめると', text: '候補から外れます（自動実行されません）。あとでまた提案されることがあります。' },
        ],
        question: 'このゴールを承認して、AI工場の自動実行の対象にしますか？',
        detail: [
          `goalId: ${g.id}`,
          `提案元: ${sourceLabel}`,
          ...(g.proposalSource ? [`proposalSource: ${g.proposalSource}`] : []),
          `指標: ${g.metric || 'progress'} ${g.current ?? 0}/${g.target ?? 100}`,
          ...(g.notes ? [g.notes] : []),
          ...(proposedAtText ? [`提案日時: ${proposedAtText}`] : []),
        ],
        actions: [
          { label: '承認して追加する', tone: 'primary', api: { url: `/api/goals/${g.id}/approve`, method: 'POST', body: { approve: true } } },
          { label: 'やめる', tone: 'danger', api: { url: `/api/goals/${g.id}/approve`, method: 'POST', body: { approve: false } } },
          { label: 'あとで', tone: 'ghost', api: null },
        ],
      }
    })

  // 自動実行（Factory）の最近の作業履歴。Inboxで「何が自動で動いたか」を一覧する（情報表示・操作ボタンなし）。
  const isAutoRun = (r: ExecutionRun) =>
    r.factoryRun === true || (typeof r.source === 'string' && /factory|schedule|boot/.test(r.source))
  const autoRuns: InboxCard[] = runs
    .filter(isAutoRun)
    .sort((a, b) => (b.finishedAt || b.startedAt || '').localeCompare(a.finishedAt || a.startedAt || ''))
    .slice(0, 10)
    .map((r) => {
      const completedAt = runCompletedAt(r)
      return {
        id: `auto-run-${r.runId}`,
        kind: 'acceptance' as const,
        ...goalForRun(r),
        ...projectForRun(r),
        sourceRunId: r.runId,
        completedAt,
        completedAtText: fmtDateTime(completedAt),
        reviewStatus: r.reviewStatus,
        headline: `自動実行: ${shorten(humanizeTitle(r.targetTodoTitle || r.summary || ''), 40)}`,
        rows: [
          { label: '結果', text: `${r.runStatus}${r.summary ? ` — ${shorten(r.summary, 60)}` : ''}` },
          { label: '日時', text: fmtDateTime(completedAt) || '不明' },
        ],
        detail: [`runId: ${r.runId}`, `状態: ${r.runStatus} / ${r.reviewStatus}`, `発生源: ${r.source ?? (r.factoryRun ? 'factory' : '不明')}`],
        actions: [],
      }
    })

  const stopFactors = cards
    .filter((c) => c.kind === 'danger' || c.kind === 'direction' || c.kind === 'human_task')
    .sort((a, b) => (stopOrder[a.kind] ?? 9) - (stopOrder[b.kind] ?? 9))
  const escalatedReviews = cards
    .filter((c) => c.kind === 'acceptance' && c.escalated)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  // レビューは完了日時（completedAt）の新しい順。完了日時が無いものは末尾。
  const reviews = cards
    .filter((c) => c.kind === 'acceptance' && !c.escalated)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const reviewCounts = {
    unconfirmed: reviews.filter((c) => c.reviewStatus === 'not_reviewed' || c.reviewStatus === 'copied' || c.reviewStatus === 'needs_human').length,
    followup: reviews.filter((c) => c.reviewStatus === 'needs_followup').length,
    snoozed: reviews.filter((c) => c.reviewStatus === 'snoozed').length,
  }
  const reviewNudgeCard: InboxCard | null = reviewCounts.unconfirmed >= REVIEW_NUDGE_THRESHOLD
    ? {
        id: 'review-unconfirmed-nudge',
        kind: 'human_task',
        ...unassignedGoal,
        ...unassignedProject,
        headline: `レビューが${reviewCounts.unconfirmed}件たまっています`,
        rows: [
          { label: '状況', text: 'AIの作業結果の確認待ちです。工場は止まりませんが、まとめて確認すると安心です。' },
        ],
        detail: [`未確認レビュー: ${reviewCounts.unconfirmed}件`, `閾値: ${REVIEW_NUDGE_THRESHOLD}件`],
        actions: [
          { label: 'まとめて確認', tone: 'primary', href: '/decide?tab=reviews', api: null },
          { label: 'あとで', tone: 'ghost', api: null },
        ],
      }
    : null
  const candidates = cards.filter((c) => c.kind === 'permission')
  // 今日の判断は上限 TODAY_LIMIT 件。単純な danger 優先 slice だと、危険レビューが多いとき
  // 方針選択(direction)・AIエスカレ・人間作業(human_task)が枠を取れず埋もれる。カテゴリ間でラウンドロビンし、
  // 各種別が最低1枠は出るようにする（danger→direction→escalatedReview→human_task の順は維持）。
  const decisions = (() => {
    const humanTaskFactors = [
      ...stopFactors.filter((c) => c.kind === 'human_task'),
      ...(reviewNudgeCard ? [reviewNudgeCard] : []),
    ]
    const queues = [
      stopFactors.filter((c) => c.kind === 'danger'),
      stopFactors.filter((c) => c.kind === 'direction'),
      escalatedReviews,
      humanTaskFactors,
    ]
    const picked: InboxCard[] = []
    let qi = 0
    while (picked.length < TODAY_LIMIT && queues.some((q) => q.length > 0)) {
      const next = queues[qi % queues.length].shift()
      if (next) picked.push(next)
      qi += 1
    }
    return picked
  })()
  const decisionFactors = [
    ...stopFactors,
    ...escalatedReviews,
    ...(reviewNudgeCard ? [reviewNudgeCard] : []),
  ]
  const decisionTotal = decisionFactors.length
  const goalIds = new Set<string>([
    ...cards.map((card) => card.goalId ?? 'unassigned'),
    ...reviewedHistory.map((card) => card.goalId ?? 'unassigned'),
    ...Object.keys(heldByGoal),
  ])
  const countByGoal = (list: InboxCard[], goalId: string) => list.filter((card) => (card.goalId ?? 'unassigned') === goalId).length
  const goalSummaries: InboxGoalSummary[] = Array.from(goalIds)
    .map((goalId) => {
      const meta = goalMeta(goalId)
      const goalReviews = reviews.filter((card) => (card.goalId ?? 'unassigned') === goalId)
      return {
        goalId,
        goalTitle: meta.goalTitle,
        today: countByGoal(decisionFactors, goalId),
        reviews: goalReviews.length + countByGoal(reviewedHistory, goalId),
        followup: goalReviews.filter((card) => card.reviewStatus === 'needs_followup').length,
        snoozed: goalReviews.filter((card) => card.reviewStatus === 'snoozed').length,
        reviewed: countByGoal(reviewedHistory, goalId),
        aiHold: heldByGoal[goalId] ?? 0,
        candidates: countByGoal(candidates, goalId),
      }
    })
    .filter((summary) => summary.today + summary.reviews + summary.aiHold + summary.candidates > 0)
    .sort((a, b) => (b.today - a.today) || (b.reviews - a.reviews) || a.goalTitle.localeCompare(b.goalTitle))

  const projectIds = new Set<string>([
    ...cards.map((card) => card.projectId ?? 'unassigned'),
    ...reviewedHistory.map((card) => card.projectId ?? 'unassigned'),
    ...Object.keys(heldByProject),
  ])
  const countByProject = (list: InboxCard[], projectId: string) =>
    list.filter((card) => (card.projectId ?? 'unassigned') === projectId).length
  const projectSummaries: InboxProjectSummary[] = Array.from(projectIds)
    .map((projectId) => {
      const projectReviews = reviews.filter((card) => (card.projectId ?? 'unassigned') === projectId)
      return {
        projectId,
        projectTitle: projectId === 'unassigned' ? '未分類' : projectTitleById.get(projectId) ?? projectId,
        today: countByProject(decisionFactors, projectId),
        reviews: projectReviews.length + countByProject(reviewedHistory, projectId),
        candidates: countByProject(candidates, projectId),
        aiHold: heldByProject[projectId] ?? 0,
      }
    })
    .filter((summary) => summary.today + summary.reviews + summary.aiHold + summary.candidates > 0)
    .sort((a, b) => (b.today - a.today) || (b.reviews - a.reviews) || a.projectTitle.localeCompare(b.projectTitle))

  return {
    decisions,
    decisionTotal,
    achievedGoalIds,
    reviews,
    reviewTotal: reviews.length,
    reviewCounts,
    reviewedHistory,
    reviewedTotal: reviewedRuns.length,
    candidates,
    candidateTotal: candidates.length,
    aiHoldCount: heldCount,
    aiHoldBreakdown: Object.entries(heldBy)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    proposedGoals,
    autoRuns,
    goalSummaries,
    projectSummaries,
    estimatedMinutes: Math.max(decisions.length, 1),
  }
}

// ---- Projects（ポートフォリオ）----

export interface ProjectCard {
  id: string
  name: string
  statusLabel: string
  statusTone: 'ok' | 'warn' | 'wait' | 'done'
  progressPct: number
  remainingWorkCount: number
  nextWork: string
  updatedAt: string
  monetizationLabel: string
  monetizationStepsRemaining: number
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
  score?: number
}

const MONETIZATION_LABEL: Record<string, string> = {
  Draft: '検討中',
  Candidate: '収益化候補',
  EpicCreated: '収益化作業中',
}

const DONE_TASK_STATUSES = new Set(['done', 'skipped', 'deleted'])
const OPEN_PROJECT_STATUSES = new Set(['in_progress', 'active', 'user_action_pending', 'deploy_ready', 'blocked'])

function clampPct(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function sameApp(projectKey: string, value?: string): boolean {
  if (!projectKey || !value) return false
  const a = projectKey.toLowerCase()
  const b = value.toLowerCase()
  return a === b || a.includes(b) || b.includes(a)
}

function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !DONE_TASK_STATUSES.has(t.status))
}

function progressFromProject(project: Project, tasks: Task[], epics: Epic[]): number {
  const linked = epics.filter((e) => (e.targetApps ?? []).some((app) => sameApp(project.id, app)) || sameApp(project.id, e.targetApp))
  if (linked.length > 0) {
    const avg = linked.reduce((sum, e) => sum + (typeof e.progress === 'number' ? e.progress : 0), 0) / linked.length
    return clampPct(Math.max(project.progress ?? 0, avg))
  }
  if (tasks.length > 0) {
    const done = tasks.filter((t) => DONE_TASK_STATUSES.has(t.status)).length
    return clampPct((done / tasks.length) * 100)
  }
  return clampPct(project.progress ?? 0)
}

function monetizationStepsRemaining(key: string, progressPct: number, candidates: MonetizationCandidateLite[], epics: Epic[]): number {
  const hasCandidate = candidates.some((c) => sameApp(key, c.targetApp) || sameApp(key, c.name) || sameApp(key, c.id))
  const hasMvpEpic = epics.some((e) => (e.targetApps ?? []).some((app) => sameApp(key, app)) && /MVP|local-first/i.test(e.title))
  const hasPublish = epics.some((e) => (e.targetApps ?? []).some((app) => sameApp(key, app)) && /公開|申請|store|Google Play|App Store/i.test(e.title))
  let done = 0
  if (hasCandidate) done += 1
  if (hasMvpEpic || progressPct >= 25) done += 1
  if (progressPct >= 70) done += 1
  if (hasPublish || progressPct >= 85) done += 1
  if (progressPct >= 90) done += 1
  if (progressPct >= 95) done += 1
  if (progressPct >= 100) done += 1
  return Math.max(0, 7 - done)
}

export interface ProjectProgressCard {
  id: string
  name: string
  progressPct: number
  remainingWorkCount: number
  nextWork: string
  updatedAt: string
  monetizationStepsRemaining: number
}

export interface GoalProgressCard {
  id: string
  title: string
  currentPlace: string
  nextMilestone: string
  achievementPct: number
  basis: string
}

function projectNameFromEpic(epic: Epic): string {
  const app = epic.targetApps?.[0] ?? epic.targetApp
  if (app) return app === 'progress' ? 'Progress（このアプリ）' : app
  return humanizeTitle(epic.title)
}

function taskMapByProject(tasksData: Awaited<ReturnType<typeof readProjectTasks>>): Map<string, Task[]> {
  return new Map(tasksData.projects.map((p) => [p.projectId, p.tasks]))
}

export async function buildProjectProgressCards(): Promise<ProjectProgressCard[]> {
  const [progressData, tasksData, epics, candidates] = await Promise.all([
    readPageAppProgress(),
    readPageProjectTasks(),
    readPageEpics(),
    readPageMonetizationCandidates(),
  ])
  const tasksByProject = taskMapByProject(tasksData)
  const cards = new Map<string, ProjectProgressCard>()

  for (const p of progressData.projects.filter((project) => !project.excluded && OPEN_PROJECT_STATUSES.has(project.status))) {
    const tasks = tasksByProject.get(p.id) ?? []
    const remaining = openTasks(tasks).length
    const progressPct = progressFromProject(p, tasks, epics)
    cards.set(p.id, {
      id: p.id,
      name: p.name,
      progressPct,
      remainingWorkCount: remaining,
      nextWork: p.nextAction || p.currentTask || '次作業未設定',
      updatedAt: p.updatedAt,
      monetizationStepsRemaining: monetizationStepsRemaining(p.id, progressPct, candidates, epics),
    })
  }

  for (const epic of epics.filter((e) => ['active', 'approved', 'blocked', 'paused'].includes(e.status))) {
    const id = epic.targetApps?.[0] ?? epic.targetApp ?? epic.epicId
    const existing = cards.get(id)
    const remaining = (epic.remainingWork ?? []).filter(Boolean).length || (epic.doneCriteria ?? []).length
    const progressPct = clampPct(epic.progress ?? existing?.progressPct ?? 0)
    cards.set(id, {
      id,
      name: existing?.name ?? projectNameFromEpic(epic),
      progressPct: Math.max(existing?.progressPct ?? 0, progressPct),
      remainingWorkCount: existing?.remainingWorkCount ?? remaining,
      nextWork: epic.nextAction || existing?.nextWork || epic.title,
      updatedAt: [existing?.updatedAt, epic.updatedAt].filter(Boolean).sort().reverse()[0] ?? epic.updatedAt,
      monetizationStepsRemaining: monetizationStepsRemaining(id, Math.max(existing?.progressPct ?? 0, progressPct), candidates, epics),
    })
  }

  return Array.from(cards.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}

function goalCurrentPlace(goal: Goal, epics: Epic[]): string {
  const linked = epics.filter((e) => e.goalId === goal.id)
  const active = linked.find((e) => ['active', 'approved', 'paused', 'blocked'].includes(e.status))
  if (active) return humanizeTitle(active.title)
  const done = linked.find((e) => e.status === 'done')
  if (done) return humanizeTitle(done.title)
  const phase = goal.phases.find((p) => p.status === 'in_progress') ?? goal.phases.find((p) => p.status === 'todo')
  return phase?.title ?? '現在地未設定'
}

function goalNextMilestone(goal: Goal, epics: Epic[]): string {
  const todo = goal.todos.find((t) => t.status !== 'done' && t.status !== 'skipped')
  if (todo) return todo.title
  const linked = epics.filter((e) => e.goalId === goal.id)
  const open = linked.find((e) => ['active', 'approved', 'paused', 'blocked'].includes(e.status))
  if (open?.nextAction) return open.nextAction
  if (open?.doneCriteria?.[0]) return open.doneCriteria[0]
  return '次マイルストーン未設定'
}

export async function buildGoalProgressCards(): Promise<GoalProgressCard[]> {
  const [goalsData, epics] = await Promise.all([readPageGoals(), readPageEpics()])
  return goalsData.goals
    .filter((g) => g.status === 'active' || g.status === 'paused')
    .map((goal) => {
      // 進捗の正本は「今/目標」(target/current = goalAchievement)に統一（ユーザー方針 2026-06-18）。
      // target 未設定のゴールのみ Todo 完了率にフォールバック（goalAchievement 内で処理）。
      const hasTarget = typeof goal.target === 'number' && goal.target > 0
      const achievementPct = goalAchievement(goal)
      const basis = hasTarget
        ? `${goal.metric || 'metric'} ${goal.current ?? 0}/${goal.target}`
        : `紐付くTodo ${goal.todos.length}件の完了率`
      return {
        id: goal.id,
        title: goal.title,
        currentPlace: goalCurrentPlace(goal, epics),
        nextMilestone: goalNextMilestone(goal, epics),
        achievementPct,
        basis,
      }
    })
}

export async function buildProjectPortfolio(): Promise<ProjectCard[]> {
  const [progressData, tasksData, epics, runs, candidates] = await Promise.all([
    readPageAppProgress(),
    readPageProjectTasks(),
    readPageEpics(),
    readPageExecutionRuns(),
    readPageMonetizationCandidates(),
  ])
  const tasksByProject = taskMapByProject(tasksData)

  function monetizationFor(key: string, stepsRemaining: number): string {
    const hit = candidates.find((c) => {
      const t = `${c.id ?? ''} ${c.name ?? ''} ${c.targetApp ?? ''}`.toLowerCase()
      return key && t.includes(key.toLowerCase())
    })
    const base = hit?.status ? (MONETIZATION_LABEL[hit.status] ?? hit.status) : '候補未登録'
    return `${base} / 残り${stepsRemaining}ステップ`
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
    const progressPct = clampPct(epic.progress ?? 0)
    const stepsRemaining = monetizationStepsRemaining(app, progressPct, candidates, epics)
    cards.push({
      id: app,
      name: app === 'progress' ? 'Progress（このアプリ）' : app,
      statusLabel: st.label,
      statusTone: st.tone,
      progressPct,
      remainingWorkCount: (epic.remainingWork ?? []).filter(Boolean).length || (epic.doneCriteria ?? []).length,
      nextWork: epic.nextAction || epic.title,
      updatedAt: run?.finishedAt || epic.updatedAt,
      monetizationLabel: monetizationFor(app, stepsRemaining),
      monetizationStepsRemaining: stepsRemaining,
    })
  }

  // 2) 既存案件（app-progress.json）のうち動きがあるもの
  for (const p of progressData.projects) {
    if (seen.has(p.id)) continue
    if (p.excluded) continue
    if (!OPEN_PROJECT_STATUSES.has(p.status)) continue
    seen.add(p.id)
    const st = PROJECT_STATUS_LABEL[p.status] ?? { label: p.status, tone: 'wait' as const }
    const tasks = tasksByProject.get(p.id) ?? []
    const progressPct = progressFromProject(p, tasks, epics)
    const stepsRemaining = monetizationStepsRemaining(p.id, progressPct, candidates, epics)
    cards.push({
      id: p.id,
      name: p.name,
      statusLabel: st.label,
      statusTone: st.tone,
      progressPct,
      remainingWorkCount: openTasks(tasks).length,
      nextWork: p.nextAction || p.currentTask || '次の作業未設定',
      updatedAt: p.updatedAt,
      monetizationLabel: monetizationFor(p.id, stepsRemaining),
      monetizationStepsRemaining: stepsRemaining,
    })
  }

  return cards.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
}
