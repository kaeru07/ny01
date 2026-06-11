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
  aiHold: { ja: 'AI保留', help: '今日見せる3件以外をAIが預かっている状態。優先度を見ながら、終わったものから順に出てきます' },
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
  /** 今日の判断（最大3件）の見出しリスト。ホームの「今日やること」カードに出す */
  todayDecisions: Array<{ kind: InboxCardKind; headline: string }>
  decisionCount: number
  /** AI保留（今日の3件以外をAIが預かっている数） */
  deferredCount: number
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
  if (todayActions.length === 0 && inbox.today.length === 0) {
    todayActions.push({ kind: 'judge', title: '今日は判断事項がありません', detail: 'AI工場が自動で進めています。Projectsで進み具合だけ確認できます', href: '/portfolio' })
  }

  const recentWins: RecentWin[] = runs
    .filter((r) => r.runStatus === 'completed' && !HIDDEN_WIN_PATTERN.test(r.targetTodoTitle))
    .slice(0, 5)
    .map((r) => ({ date: fmtDate(r.finishedAt || r.startedAt), app: r.targetApp, title: r.targetTodoTitle || r.summary }))

  return {
    todayActions,
    todayDecisions: inbox.today.map((c) => ({ kind: c.kind, headline: c.headline })),
    decisionCount: inbox.today.length,
    deferredCount: inbox.deferredCount,
    estimatedMinutes: inbox.estimatedMinutes,
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

/** 画面上の3分類。goal は内部都合（紐付けUI用）で、画面上は「確認」として出す。 */
export type InboxCardKind = 'problem' | 'improve' | 'confirm' | 'goal'

/** 画面上のチップ表示（3分類のみ）。 */
export const KIND_CHIP_LABEL: Record<InboxCardKind, string> = {
  problem: '🚨 問題',
  improve: '📈 改善',
  confirm: '✅ 確認',
  goal: '✅ 確認',
}

export interface InboxCardAction {
  label: string
  tone: 'primary' | 'ghost' | 'danger'
  api: { url: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> }
}

export interface InboxCard {
  id: string
  kind: InboxCardKind
  /** 何が起きているか（状況文）。タスク名ではない。内部語禁止 */
  headline: string
  /** なぜ必要か / 放置するとどうなるか（必須1行）。内部語禁止 */
  impact: string
  /** 末尾の問いかけ（修正しますか？等）。confirm 系は impact が指示文なので省略可 */
  question?: string
  /** 「詳細を見る」内にだけ出す説明（内部ID・内部ステータス・元タスク名可） */
  detail: string[]
  actions: InboxCardAction[]
  /** kind === 'goal' のときの紐付け先候補 */
  goals?: Array<{ id: string; title: string }>
  epicId?: string
}

/** Inbox の画面ビュー。社長アプリとして今日見せるのは最大3件、残りはAI保留。 */
export interface InboxView {
  today: InboxCard[]
  deferredCount: number
  totalCount: number
  estimatedMinutes: number
}

/** 内部の命名規則（Run一次レビュー: / epic-xxx / 次Epic候補 / Run / Factory 等）をタイトルから除く・人間語へ置換する。 */
function humanizeTitle(title: string): string {
  let t = title
  const patterns: Array<[RegExp, string]> = [
    [/^Run一次レビュー:\s*/i, ''],
    [/^レビュー起点:\s*/, ''],
    [/^epic[-_][\w-]+:\s*/i, ''],
    [/^Factory\(auto\):\s*/i, ''],
    [/の次Epic候補$/i, ''],
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
  // 全体が括弧で包まれているだけなら外す
  const wrapped = t.match(/^（(.+)）$/) ?? t.match(/^\((.+)\)$/)
  if (wrapped) t = wrapped[1].trim()
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

/** タスク名から「何の話か」の主語を取り出す（末尾の補足括弧と作業動詞を落とす）。 */
function subjectOf(clean: string): string {
  let s = clean
    .replace(/（[^）]*）$|\([^)]*\)$/, '')
    .trim()
  for (let i = 0; i < 2; i++) {
    s = s
      .replace(/(を|の)?(調査・修正|調査|修正|対応|改修|確認|改善|追加|実装|整備)(する)?$/, '')
      .replace(/（[^）]*）$|\([^)]*\)$/, '')
      .replace(/[、。・\s]+$/, '')
      .trim()
  }
  return s || clean
}

/** ドメイン語から「放置するとどうなるか」を推定する。 */
function impactOfProblem(text: string): string {
  if (/市場調査/.test(text)) return '放置すると毎日の市場調査結果が更新されません。'
  if (/ニュース/.test(text)) return '放置するとニュース要約が止まります。'
  if (/(更新|同期)/.test(text)) return '放置するとデータが古いまま更新されません。'
  if (/(公開|デプロイ|反映)/.test(text)) return '放置すると最新の内容が公開されないままになります。'
  return '放置するとこの部分が止まったままになります。'
}

function impactOfImprove(text: string): string {
  if (/(自動化|自動)/.test(text)) return '実施すると手作業が減ります。'
  if (/(精度|品質)/.test(text)) return '実施すると結果の品質が上がります。'
  if (/(調査|分析)/.test(text)) return '実施すると次の打ち手が明確になります。'
  if (/(取り込み|収集|データ)/.test(text)) return '実施すると使えるデータが増えます。'
  return '実施すると品質が上がり、手作業が減ります。'
}

interface Situation {
  kind: 'problem' | 'improve' | 'confirm'
  headline: string
  impact: string
  question?: string
}

/**
 * タスク名（何をやるか）を状況文（何が起きているか）へ変換する。
 * 例: 「市場調査ビューのVault更新停止を調査・修正」→「市場調査ビューの自動更新が止まっています」
 */
function describeSituation(title: string, base: 'confirm' | 'suggest'): Situation {
  const clean = humanizeTitle(title)
  const subject = subjectOf(clean)
  const short = subject.length > 26 ? `${subject.slice(0, 26)}…` : subject

  // 確認系（完了済み作業のチェック）は、タイトルに障害語があっても「完了の確認」が実態。最優先で判定する
  if (base === 'confirm') {
    const isPublish = /(公開|デプロイ|Vercel|反映)/i.test(clean)
    const wasFix = /(不具合|失敗|エラー|停止|障害)/.test(clean)
    return {
      kind: 'confirm',
      headline: isPublish ? '公開作業が完了しました' : wasFix ? `「${short}」の修正作業が完了しました` : `「${short}」の作業が完了しました`,
      impact: isPublish ? '正常に公開されたか確認してください。' : '内容に問題がないか確認してください。問題なければAIが次に進みます。',
    }
  }

  // 問題系: 止まっている / 失敗した / 修正が必要
  if (/(停止|止ま|失敗|エラー|不具合|障害|落ち|ダウン)/.test(clean)) {
    const isUpdate = /(更新|同期|反映)/.test(clean)
    const isFactoryFail = /AI工場.*失敗|失敗.*AI工場/.test(clean)
    // 「市場調査ビューのVault更新停止」→「市場調査ビュー」のように障害語の塊を主語から外す
    const what = subject
      .replace(/(の)?(Vault)?(日次)?(更新|同期|反映|連携)*(不具合|停止|エラー|失敗|障害)(の解消)?$/, '')
      .replace(/(の)?失敗(した)?作業$/, '')
      .replace(/[、。・の\s]+$/, '')
      .trim()
    const whatShort = what.length > 26 ? `${what.slice(0, 26)}…` : what
    return {
      kind: 'problem',
      headline: isFactoryFail
        ? 'AI工場の自動作業が失敗しています'
        : isUpdate
          ? `${whatShort || 'データ'}の自動更新が止まっています`
          : `${whatShort || 'AIの作業'}で問題が起きています`,
      impact: isFactoryFail ? '放置すると自動作業が進まないままになります。' : impactOfProblem(clean),
      question: '修正しますか？',
    }
  }

  // 改善系: 良くなる / 自動化できる / 効率化できる
  return {
    kind: 'improve',
    headline: `${short}を改善できます`,
    impact: impactOfImprove(clean),
    question: '実施しますか？',
  }
}

/** 今日見せる上限。社長アプリとして「3件・約3分」を超えない。 */
const TODAY_LIMIT = 3

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

  // ① 承認待ち → 状況文に変換（問題 / 改善 / 確認）
  for (const a of approvals) {
    const isReviewDecision = a.options.some((o) => /問題なし|フォローアップ/.test(o.label))
    const s = describeSituation(a.title, isReviewDecision ? 'confirm' : 'suggest')
    const sorted = [...a.options].sort((x, y) => (x.key === a.recommended ? -1 : y.key === a.recommended ? 1 : 0))
    cards.push({
      id: `approval-${a.approvalId}`,
      kind: s.kind,
      headline: s.headline,
      impact: s.impact,
      question: s.question,
      detail: [
        `元のタスク名: ${a.title}`,
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

  // ② AIが判断を保留した作業結果 → 確認
  const approvalRunIds = new Set(approvals.map((a) => a.createdRunId).filter(Boolean))
  for (const run of runs.filter((r) => r.reviewStatus === 'needs_human' && !approvalRunIds.has(r.runId))) {
    const s = describeSituation(run.targetTodoTitle || run.summary || run.runId, 'confirm')
    cards.push({
      id: `run-${run.runId}`,
      kind: s.kind,
      headline: s.headline,
      impact: s.impact,
      question: s.question,
      detail: [
        `元のタスク名: ${run.targetTodoTitle || run.summary || ''}`,
        `AIの見解: ${run.aiReview?.reason ?? 'AIだけでは判断できなかった作業結果です'}`,
        `元の作業履歴: ${run.runId}`,
      ],
      actions: [
        { label: '問題なし', tone: 'primary', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'reviewed' } } },
        { label: '修正する', tone: 'danger', api: { url: `/api/execution-runs/${run.runId}`, method: 'PATCH', body: { reviewStatus: 'needs_followup' } } },
      ],
    })
  }

  // ③ 目標未紐付けの大きな作業 → 確認（目標が未設定という「起きていること」）
  const openStatuses = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
  for (const epic of epics.filter((e) => openStatuses.has(e.status) && !e.goalId)) {
    cards.push({
      id: `orphan-${epic.epicId}`,
      kind: 'goal',
      headline: `「${humanizeTitle(epic.title)}」の目標が未設定です`,
      impact: '紐付けないと、この作業がどの目標に貢献しているか追跡できません。',
      question: 'どの目標に紐付けますか？',
      detail: [`元のタスク名: ${epic.title}`, `内部ID: ${epic.epicId}`, '紐付けが不要な作業は「不要」で取り下げられます'],
      actions: [],
      goals,
      epicId: epic.epicId,
    })
  }

  // ④ おすすめ次作業 → 問題（修正系）or 改善
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 }
  const suggested = recommendations
    .filter((r) => r.status === 'suggested')
    .sort((a, b) => {
      const p = (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
      if (p !== 0) return p
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
  for (const rec of suggested) {
    const s = describeSituation(rec.title, 'suggest')
    cards.push({
      id: `candidate-${rec.id}`,
      kind: s.kind,
      headline: s.headline,
      impact: s.impact,
      question: s.question,
      detail: [
        `元のタスク名: ${rec.title}`,
        `なぜ提案された？: ${rec.reason}`,
        ...(rec.sourceRunId ? [`元の作業履歴: ${rec.sourceRunId}`] : []),
        ...(rec.sourceRef ? [`提案の出どころ: ${rec.sourceRef}`] : []),
        `内部ID: ${rec.id}`,
      ],
      actions: [
        { label: s.kind === 'problem' ? '修正する' : '実施する', tone: 'primary', api: { url: `/api/recommended-epics/${rec.id}/approve`, method: 'POST', body: {} } },
        { label: 'あとで', tone: 'ghost', api: { url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'hold', detail: '今日の判断で「あとで」を選択' } } },
        { label: 'やめる', tone: 'danger', api: { url: `/api/recommended-epics/${rec.id}`, method: 'PATCH', body: { status: 'rejected', detail: '今日の判断で「やめる」を選択' } } },
      ],
    })
  }

  // 今やるべき順: 問題 → 確認 → 目標未設定 → 改善。今日は最大3件、残りはAI保留。
  const order: Record<InboxCardKind, number> = { problem: 0, confirm: 1, goal: 2, improve: 3 }
  cards.sort((a, b) => order[a.kind] - order[b.kind])
  const today = cards.slice(0, TODAY_LIMIT)

  return {
    today,
    deferredCount: Math.max(cards.length - today.length, 0),
    totalCount: cards.length,
    estimatedMinutes: Math.max(today.length, 1),
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
