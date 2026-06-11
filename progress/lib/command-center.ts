import { readJson } from '@/lib/store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readAppProgress, readProjectTasks } from '@/lib/progress-reader'
import { getAutomationConfig, getEpics, getPendingApprovals } from '@/lib/operations-store'
import { computeFactoryMetrics, type FactoryMetrics } from '@/lib/factory-metrics'
import { readGoals } from '@/lib/goal-reader'
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
  notReviewed: { ja: '未確認の作業履歴', help: 'AIの作業結果のうち、まだ内容確認が済んでいないもの' },
  needsHuman: { ja: 'あなたの判断待ち', help: 'AIだけでは決められず、人間の判断を待っている項目' },
  inbox: { ja: '今日の判断', help: 'あなたが「はい・いいえ・あとで」を選ぶだけの判断箱。処理すると消え、内部の管理はAIが行います' },
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
  /** 今日の判断（Inbox）の残り件数。中身はホームに出さない（社長向け: 件数と入口だけ） */
  decisionCount: number
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
    statusLabel = '一時停止中（確認待ちが多いため）'
    statusTone = 'alert'
    description = `未確認の作業履歴が${metrics.notReviewedCount}件たまっているため、新しい自動作業を止めています。下の「AIにまとめて確認させる」で解消できます。`
  } else if (level === 'slow_down') {
    statusLabel = '減速運転中'
    statusTone = 'warn'
    description = `未確認の作業履歴が${metrics.notReviewedCount}件あるため、自動作業のペースを落としています。`
  }
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

  // 今日やること: ①判断（今日の判断） ②AIに任せる確認 ③あなたの番の作業
  const todayActions: TodayAction[] = []
  if (inbox.length > 0) {
    todayActions.push({
      kind: 'judge',
      title: `判断する（${inbox.length}件）`,
      detail: 'はい・いいえ・あとで を選ぶだけです。3〜5分で終わります',
      href: '/decide',
    })
  }
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
  if (todayActions.length === 0) {
    todayActions.push({ kind: 'judge', title: '今日は判断事項がありません', detail: 'AI工場が自動で進めています。Projectsで進み具合だけ確認できます', href: '/portfolio' })
  }

  const recentWins: RecentWin[] = runs
    .filter((r) => r.runStatus === 'completed' && !HIDDEN_WIN_PATTERN.test(r.targetTodoTitle))
    .slice(0, 5)
    .map((r) => ({ date: fmtDate(r.finishedAt || r.startedAt), app: r.targetApp, title: r.targetTodoTitle || r.summary }))

  return {
    todayActions,
    decisionCount: inbox.length,
    factory,
    milestones,
    recentWins,
    metrics,
  }
}

// ---- 今日の判断（社長向け承認カード）----
// 内部分類（approval / needs_human run / orphan epic / suggested candidate）はここで畳み、
// 画面には「作業結果の確認 / 次の作業 / Goal紐付け」の3種類しか出さない。
// ExecutionRun / runId / reviewed / Knowledge 等の内部語は question に出さず、
// detail（「詳細を見る」を押した時だけ表示）の中にのみ置く。

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

export type InboxCardKind = 'confirm' | 'proceed' | 'goal'

export interface InboxCardAction {
  label: string
  tone: 'primary' | 'ghost' | 'danger'
  api: { url: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> }
}

export interface InboxCard {
  id: string
  kind: InboxCardKind
  /** 画面上の3分類: 作業結果の確認 / 次の作業 / Goal紐付け */
  kindLabel: string
  /** 人間語の質問1文。内部語禁止 */
  question: string
  /** 「詳細を見る」内にだけ出す説明（内部ID・内部ステータス可） */
  detail: string[]
  actions: InboxCardAction[]
  /** kind === 'goal' のときの紐付け先候補 */
  goals?: Array<{ id: string; title: string }>
  epicId?: string
}

/** 内部の命名規則（Run一次レビュー: / epic-xxx: / 次Epic候補 等）をタイトルから除く。 */
function humanizeTitle(title: string): string {
  let t = title
  const patterns: Array<[RegExp, string]> = [
    [/^Run一次レビュー:\s*/i, ''],
    [/^レビュー起点:\s*/, ''],
    [/^epic[-_][\w-]+:\s*/i, ''],
    [/^Factory\(auto\):\s*/i, ''],
    [/の次Epic候補$/i, ''],
    [/\s*\((schedule|boot)\/[^)]*\)/gi, ''],
  ]
  for (const [re, rep] of patterns) t = t.replace(re, rep)
  t = t.trim().replace(/[、。\s]+$/, '')
  return t || title
}

/** 承認オプションのラベルを「はい/あとで/やめる」系の人間語へ寄せる。 */
function humanizeOptionLabel(label: string): string {
  if (/問題なし/.test(label)) return '問題なし'
  if (/フォローアップ|修正|再試行/.test(label)) return '修正する'
  if (/保留|あとで/.test(label)) return 'あとで'
  if (/承認|進める|はい/.test(label)) return 'はい'
  if (/却下|見送|やめる|中止/.test(label)) return 'やめる'
  // 括弧内の内部語（reviewedにする 等）だけ落とす
  return label.replace(/（[^）]*）|\([^)]*\)/g, '').trim() || label
}

export async function buildInbox(): Promise<InboxCard[]> {
  const [approvals, epics, recommendations, runs, goalsData] = await Promise.all([
    getPendingApprovals(),
    getEpics(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
    readExecutionRuns(),
    readGoals(),
  ])
  const goals = goalsData.goals.map((g) => ({ id: g.id, title: g.title }))
  const cards: InboxCard[] = []

  // ① 承認待ち → 「作業結果の確認」or「次の作業」
  for (const a of approvals) {
    const isReviewDecision = a.options.some((o) => /問題なし|フォローアップ/.test(o.label))
    const sorted = [...a.options].sort((x, y) => (x.key === a.recommended ? -1 : y.key === a.recommended ? 1 : 0))
    cards.push({
      id: `approval-${a.approvalId}`,
      kind: isReviewDecision ? 'confirm' : 'proceed',
      kindLabel: isReviewDecision ? '作業結果の確認' : '次の作業',
      question: isReviewDecision
        ? `「${humanizeTitle(a.title)}」の作業が終わりました。問題ありませんか？`
        : `「${humanizeTitle(a.title)}」を進めますか？`,
      detail: [
        `判断の種類: ${CATEGORY_LABEL[a.category] ?? a.category}`,
        `AIの説明: ${a.reason}`,
        ...(a.createdRunId ? [`元の作業履歴: ${a.createdRunId}`] : []),
        `内部ID: ${a.approvalId}`,
      ],
      actions: sorted.map((o) => ({
        label: humanizeOptionLabel(o.label),
        tone: o.key === a.recommended ? 'primary' : /却下|見送|やめる|フォローアップ|修正/.test(o.label) ? 'danger' : 'ghost',
        api: { url: '/api/operations/approvals', method: 'POST', body: { approvalId: a.approvalId, decidedOption: o.key } },
      })),
    })
  }

  // ② AIが判断を保留した作業結果 → 「作業結果の確認」
  const approvalRunIds = new Set(approvals.map((a) => a.createdRunId).filter(Boolean))
  for (const run of runs.filter((r) => r.reviewStatus === 'needs_human' && !approvalRunIds.has(r.runId))) {
    cards.push({
      id: `run-${run.runId}`,
      kind: 'confirm',
      kindLabel: '作業結果の確認',
      question: `「${humanizeTitle(run.targetTodoTitle || run.summary || run.runId)}」の作業が終わりました。問題ありませんか？`,
      detail: [
        `AIの見解: ${run.aiReview?.reason ?? 'AIだけでは判断できなかった作業結果です'}`,
        `元の作業履歴: ${run.runId}`,
      ],
      actions: [
        { label: '問題なし', tone: 'primary', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'reviewed' } } },
        { label: '修正する', tone: 'danger', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'needs_followup' } } },
      ],
    })
  }

  // ③ 目標未紐付けの大きな作業 → 「Goal紐付け」
  const openStatuses = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
  for (const epic of epics.filter((e) => openStatuses.has(e.status) && !e.goalId)) {
    cards.push({
      id: `orphan-${epic.epicId}`,
      kind: 'goal',
      kindLabel: 'Goal紐付け',
      question: `「${humanizeTitle(epic.title)}」— この作業はどの目標に紐付けますか？`,
      detail: [`内部ID: ${epic.epicId}`, '紐付けが不要な作業は「不要」で取り下げられます'],
      actions: [],
      goals,
      epicId: epic.epicId,
    })
  }

  // ④ おすすめ次作業 → 「次の作業」
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 }
  const topSuggested = recommendations
    .filter((r) => r.status === 'suggested')
    .sort((a, b) => {
      const p = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
      if (p !== 0) return p
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
    .slice(0, 3)
  for (const rec of topSuggested) {
    cards.push({
      id: `candidate-${rec.id}`,
      kind: 'proceed',
      kindLabel: '次の作業',
      question: `「${humanizeTitle(rec.title)}」を進めますか？`,
      detail: [
        `なぜ提案された？: ${rec.reason}`,
        ...(rec.sourceRunId ? [`元の作業履歴: ${rec.sourceRunId}`] : []),
        ...(rec.sourceRef ? [`提案の出どころ: ${rec.sourceRef}`] : []),
        `内部ID: ${rec.id}`,
      ],
      actions: [
        { label: 'はい', tone: 'primary', api: { url: `/api/recommended-epics/${rec.id}/approve`, method: 'POST', body: {} } },
        { label: 'あとで', tone: 'ghost', api: { url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'hold', detail: '今日の判断で「あとで」を選択' } } },
        { label: 'やめる', tone: 'danger', api: { url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'rejected', detail: '今日の判断で「やめる」を選択' } } },
      ],
    })
  }

  return cards
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
