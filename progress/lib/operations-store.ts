import { readJson, writeJson, appendNdjson, readNdjson } from './store'
import type {
  Epic,
  Approval,
  ApprovalPriority,
  OperationalDecision,
  HealthSummary,
  AutomationReadiness,
  ApprovalCategory,
  ExecutorSummary,
  ExecutorType,
  DecisionContext,
  GeneratedHandoff,
  NextTodoCandidate,
  PendingTodoGenerationResult,
  EpicDetail,
  ExecutionRunBrief,
  AutomationConfig,
  CodexPrompt,
  AutoFallbackResult,
  FallbackBlock,
  AutomationLogEntry,
  ClaudeLimitDetection,
  EpicContractInput,
  EpicPriority,
  EpicRiskFlag,
  FactoryEligibility,
} from './types/operations'
import { evaluateFactoryEligibility, buildExecutionGuard } from './epic-contract'
import type { WorkQueueData } from '@/types/session'
import type { AppProgress, ProjectTasksData, Task, TaskPriority } from '@/types/progress'
import type { ExecutionRunsData, ExecutionRun } from '@/types/execution-run'
import type { WorkSession } from '@/types/session'

const PRIORITY_ORDER: Record<ApprovalPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

// ---- Epics ----

export async function getEpics(): Promise<Epic[]> {
  return readJson<Epic[]>('epics.json', [])
}

export async function getEpic(epicId: string): Promise<Epic | null> {
  const epics = await getEpics()
  return epics.find((e) => e.epicId === epicId) ?? null
}

/**
 * ExecutionRun を Epic に自動結合する。POST で epicId 明示があればそれを尊重、
 * 無ければ targetApp / targetTodoId から Epic.targetApps / relatedTodoIds で推定する。
 * 該当 Epic が無ければ undefined（無理に結合しない）。
 */
export async function resolveEpicId(input: {
  epicId?: string
  targetApp?: string
  targetTodoId?: string
}): Promise<string | undefined> {
  if (input.epicId) return input.epicId
  const epics = await getEpics()
  if (input.targetTodoId) {
    const byTodo = epics.find((e) => e.relatedTodoIds?.includes(input.targetTodoId!))
    if (byTodo) return byTodo.epicId
  }
  if (input.targetApp) {
    const app = normalizeApp(input.targetApp)
    const byApp = epics.find((e) => (e.targetApps ?? []).map(normalizeApp).includes(app))
    if (byApp) return byApp.epicId
  }
  return undefined
}

export async function updateEpic(epicId: string, patch: Partial<Epic>): Promise<Epic | null> {
  const epics = await getEpics()
  const idx = epics.findIndex((e) => e.epicId === epicId)
  if (idx === -1) return null
  const updated: Epic = { ...epics[idx], ...patch, epicId, updatedAt: new Date().toISOString() }
  epics[idx] = updated
  await writeJson('epics.json', epics)
  return updated
}

export async function decideEpicAction(input: {
  epicId: string
  action: 'approve' | 'reject' | 'assignGoal' | 'changePriority' | 'pause' | 'drop'
  goalId?: string
  priority?: EpicPriority
}): Promise<Epic | null> {
  const patch: Partial<Epic> = {}
  if (input.action === 'approve') patch.status = 'approved'
  if (input.action === 'reject') patch.status = 'dropped'
  if (input.action === 'pause') patch.status = 'paused'
  if (input.action === 'drop') patch.status = 'dropped'
  if (input.action === 'assignGoal') {
    if (!input.goalId) throw new Error('goalId is required')
    patch.goalId = input.goalId
  }
  if (input.action === 'changePriority') {
    if (!input.priority || !['P0', 'P1', 'P2'].includes(input.priority)) throw new Error('valid priority is required')
    patch.priority = input.priority
  }
  const updated = await updateEpic(input.epicId, patch)
  if (updated) {
    await recordOperationalDecision({
      action: input.action,
      topic: `Epic ${input.action}: ${updated.title}`,
      decision: input.action === 'assignGoal'
        ? `goalId=${input.goalId} に紐付け`
        : input.action === 'changePriority'
          ? `priority=${input.priority} に変更`
          : `status=${updated.status} に変更`,
      epicId: updated.epicId,
      goalId: input.goalId,
    })
  }
  return updated
}

function slugForEpicId(title: string): string {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)
  if (ascii) return ascii
  return Math.random().toString(36).slice(2, 8)
}

/**
 * Epic Contract から新しい Epic を作成する（epics.json に追記。新正本は作らない）。
 * 既存 Epic は破壊しない。targetApp は targetApps[0] にマップする。
 */
export async function createEpic(input: EpicContractInput & { epicId?: string }): Promise<Epic> {
  const epics = await getEpics()
  const now = new Date().toISOString()
  let epicId = input.epicId?.trim() || `epic-${slugForEpicId(input.title)}`
  if (epics.some((e) => e.epicId === epicId)) {
    epicId = `${epicId}-${Date.now().toString(36).slice(-4)}`
  }

  const epic: Epic = {
    epicId,
    goalId: input.goalId,
    relatedTodoIds: input.relatedTodoIds,
    title: input.title,
    goal: input.goal,
    progress: 0,
    remainingWork: [],
    nextAction: '',
    decisionPolicy: input.decisionPolicy,
    status: 'active',
    updatedAt: now,
    doneCriteria: input.doneCriteria,
    priority: input.priority,
    riskFlags: input.riskFlags,
    notes: input.notes,
    relatedRepo: input.relatedRepo,
    preferredExecutor: input.preferredExecutor,
    fallbackExecutor: input.fallbackExecutor,
    factoryEligible: input.factoryEligible,
    targetApps: input.targetApp ? [input.targetApp] : undefined,
  }
  epics.push(epic)
  await writeJson('epics.json', epics)
  return epic
}

/** Epic の Factory/Auto Resume 自動実行対象判定（承認待ち件数を加味）。 */
export async function getFactoryEligibility(epicId: string): Promise<FactoryEligibility | null> {
  const epic = await getEpic(epicId)
  if (!epic) return null
  const pending = await getPendingApprovals()
  const pendingApprovalCount = pending.filter((a) => a.epicId === epicId).length
  return evaluateFactoryEligibility(epic, { pendingApprovalCount })
}

// ---- Approvals ----

export async function getApprovals(): Promise<Approval[]> {
  return readJson<Approval[]>('approvals.json', [])
}

export async function getPendingApprovals(): Promise<Approval[]> {
  const approvals = await getApprovals()
  return approvals
    .filter((a) => a.status === 'pending')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

export async function decideApproval(
  approvalId: string,
  decidedOption: string,
  decidedBy = 'operator',
): Promise<Approval | null> {
  const approvals = await getApprovals()
  const idx = approvals.findIndex((a) => a.approvalId === approvalId)
  if (idx === -1) return null

  const now = new Date().toISOString()
  const decided: Approval = {
    ...approvals[idx],
    status: 'decided',
    decidedOption,
    decidedBy,
    decidedAt: now,
  }
  approvals[idx] = decided
  await writeJson('approvals.json', approvals)

  const decision: OperationalDecision = {
    decisionId: `dec-${Date.now()}`,
    epicId: decided.epicId,
    topic: decided.title,
    decision: decidedOption,
    approvalId: decided.approvalId,
    decidedAt: now,
    action: decidedOption === 'approve' || decidedOption === 'reject' ? decidedOption : 'approval_decided',
    runId: decided.createdRunId,
    source: 'human',
  }
  await appendNdjson('operational-decisions.ndjson', decision)

  return decided
}

export async function createApproval(input: {
  epicId?: string
  title: string
  category: ApprovalCategory
  priority?: ApprovalPriority
  options: Approval['options']
  recommended: string
  reason: string
  createdRunId?: string
}): Promise<Approval> {
  const approvals = await getApprovals()
  const now = new Date().toISOString()
  const approval: Approval = {
    approvalId: `appr-${Date.now()}`,
    epicId: input.epicId,
    title: input.title,
    category: input.category,
    priority: input.priority ?? 'normal',
    options: input.options,
    recommended: input.recommended,
    reason: input.reason,
    status: 'pending',
    createdRunId: input.createdRunId,
    createdAt: now,
  }
  approvals.push(approval)
  await writeJson('approvals.json', approvals)
  return approval
}

// ---- Operational decisions ----

export async function getOperationalDecisions(): Promise<OperationalDecision[]> {
  return readNdjson<OperationalDecision>('operational-decisions.ndjson')
}

let decisionSeq = 0

/** 運用上の判断（approve / reject / assignGoal / markReviewed / factory pause 等）を Decision Log に追記する。 */
export async function recordOperationalDecision(input: {
  action: string
  topic: string
  decision: string
  type?: string
  targetId?: string
  note?: string
  epicId?: string
  runId?: string
  goalId?: string
  approvalId?: string
  source?: 'human' | 'ai' | 'app-proposals-page'
}): Promise<OperationalDecision> {
  decisionSeq = (decisionSeq + 1) % 1000
  const now = new Date().toISOString()
  const entry: OperationalDecision = {
    decisionId: `dec-${Date.now()}-${decisionSeq}`,
    type: input.type,
    targetId: input.targetId,
    time: now,
    epicId: input.epicId,
    topic: input.topic,
    decision: input.decision,
    note: input.note,
    approvalId: input.approvalId,
    decidedAt: now,
    action: input.action,
    runId: input.runId,
    goalId: input.goalId,
    source: input.source ?? 'human',
  }
  await appendNdjson('operational-decisions.ndjson', entry)
  return entry
}

export async function buildDecisionContext(limit = 20): Promise<DecisionContext> {
  const decisions = (await getOperationalDecisions()).slice(-limit)
  const lines = decisions.map((d) => {
    const scope = d.epicId ? `${d.epicId}: ` : ''
    return `- ${scope}${d.topic} => ${d.decision} (${d.decidedAt})`
  })
  return {
    decisions,
    promptBlock: [
      '## Decision Log（前回までの確定判断）',
      lines.length > 0 ? lines.join('\n') : '- まだ確定判断はありません',
      '',
      'この判断と矛盾する作業は実行せず、必要なら Approval Queue に登録してください。',
    ].join('\n'),
    readTiming: [
      'vloop開始時',
      'executor開始時',
      'handoff生成時',
      'Approval Queueを作る前',
    ],
    injectionTargets: [
      '集中作業プロンプト',
      'Codex実行プロンプト',
      'handoff生成ビュー',
      'ExecutionRunレビューからの次ToDo生成',
    ],
  }
}

// ---- Health summary (read-only aggregation, no new persistence) ----

const STALE_DAYS = 7
const STALE_STATUSES = ['in_progress', 'active']

export async function computeHealthSummary(): Promise<HealthSummary> {
  const workQueue = await readJson<WorkQueueData>('work-queue.json', { items: [], lastGenerated: '' })
  const appProgress = await readJson<AppProgress>('app-progress.json', { projects: [] })
  const pending = await getPendingApprovals()
  const epics = await getEpics()

  const runnable = workQueue.items.filter((q) => q.status === 'queued').length
  const running = workQueue.items.filter((q) => q.status === 'in_progress').length
  const stopped = workQueue.items.filter((q) => q.status === 'blocked').length
  const epicsActive = epics.filter((e) => e.status === 'active').length

  const now = Date.now()
  const stale = appProgress.projects.filter((app) => {
    if (!STALE_STATUSES.includes(app.status)) return false
    const updated = Date.parse(app.updatedAt)
    if (Number.isNaN(updated)) return false
    const ageDays = (now - updated) / (1000 * 60 * 60 * 24)
    return ageDays >= STALE_DAYS
  }).length

  return {
    runnable,
    running,
    pendingApproval: pending.length,
    limitWaiting: 0,
    stopped,
    epicsActive,
    stale,
  }
}

// ---- Automation readiness (read-only aggregation, no queue creation) ----

const OPEN_TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'impl_done', 'local_done']
const EXECUTORS: ExecutorType[] = ['claude', 'codex', 'manual', 'other']
const HANDOFF_SECTIONS = [
  '目的',
  '現在地',
  '変更済みファイル',
  '未完了作業',
  '禁止事項',
  '検証条件',
  'Decision Log',
  '承認待ち',
]

// ---- Executor 適格性ポリシー（Claude→Codex 自動切替の共有判定） ----
// handoff は UI 非表示のまま、この判定に基づき内部で executor を選ぶ。

/** Codex へ渡してよい安全シグナル（方針決定済み・非破壊作業） */
export const CODEX_ALLOW_SIGNALS = [
  'lint', 'typecheck', 'type check', 'build', 'test', 'テスト', 'document', 'docs', 'ドキュメント',
  'vault', 'integ', 'issue', 'ui', 'copy', '文言', 'リファクタ', '整理', 'スタイル', 'format',
]

/** Codex へ渡さない危険シグナル（Claude 専任 / 人間判断が必要） */
export const CODEX_DENY_SIGNALS = [
  '課金', 'billing', '本番db', 'production db', '本番', 'destructive', '削除', 'drop ', 'truncate',
  'secret', 'token', '認証', 'credential', '外部公開', 'publish', 'deploy', 'デプロイ',
  'pm2', 'cron', 'systemd', 'migration', 'マイグレーション', 'スキーマ変更', '.env',
]

export interface CodexEligibility {
  eligible: boolean
  reason: string
}

/** テキストから Codex 自動切替の可否を判定する（最終ゲートは requiresClaude / Approval Queue）。 */
export function classifyCodexEligibility(text: string): CodexEligibility {
  const t = text.toLowerCase()
  const deny = CODEX_DENY_SIGNALS.find((s) => t.includes(s))
  if (deny) return { eligible: false, reason: `危険シグナル「${deny}」を含むため Claude 専任` }
  const allow = CODEX_ALLOW_SIGNALS.find((s) => t.includes(s))
  if (allow) return { eligible: true, reason: `安全シグナル「${allow}」に該当` }
  return { eligible: false, reason: '安全シグナル未検出のため既定で Claude' }
}

function getTaskExecutor(task: Task): ExecutorType {
  if (task.preferredExecutor) return task.preferredExecutor
  if (task.assignee === 'user') return 'manual'
  return 'claude'
}

function canRunOnCodex(task: Task): boolean {
  if (task.requiresClaude) return false
  if (task.canRunOnCodex) return true
  if (task.fallbackExecutor === 'codex') return true
  if (task.assignee === 'both') return true
  const text = `${task.title} ${task.memo} ${task.taskPrompt ?? ''}`
  return classifyCodexEligibility(text).eligible
}

function executorFromRun(run: ExecutionRun): ExecutorType {
  if (run.executorUsed) return run.executorUsed
  const text = `${run.promptUsed ?? ''} ${run.rawReport ?? ''}`.toLowerCase()
  if (text.includes('codex')) return 'codex'
  if (text.includes('manual')) return 'manual'
  return 'claude'
}

function summarizeExecutors(tasks: Task[], queue: WorkQueueData, runs: ExecutionRun[]): ExecutorSummary[] {
  return EXECUTORS.map((executor) => {
    const runnableTasks = tasks.filter((task) => {
      if (!OPEN_TASK_STATUSES.includes(task.status)) return false
      if (executor === 'codex') return canRunOnCodex(task)
      return getTaskExecutor(task) === executor
    }).length
    const running = queue.items.filter((item) => {
      if (item.status !== 'in_progress') return false
      const preferred = item.preferredExecutor ?? (item.requiresClaude ? 'claude' : undefined)
      if (preferred) return preferred === executor
      if (executor === 'codex') return Boolean(item.canRunOnCodex || item.fallbackExecutor === 'codex')
      return executor === 'claude'
    }).length
    const executorRuns = runs.filter((run) => executorFromRun(run) === executor)
    return {
      executor,
      runnable: runnableTasks,
      running,
      completedRuns: executorRuns.filter((run) => run.runStatus === 'completed').length,
      failedRuns: executorRuns.filter((run) => run.runStatus === 'failed').length,
    }
  })
}

// nextActions は型上 string[] だが、executor が誤って {title,...} 等のオブジェクトを
// POST するケースがあるため、描画前にここで必ず文字列へ正規化する（全経路が通る防御点）。
function nextActionText(action: unknown): string {
  if (typeof action === 'string') return action
  if (action && typeof action === 'object') {
    const o = action as Record<string, unknown>
    if (typeof o.title === 'string') return o.title
    if (typeof o.text === 'string') return o.text
  }
  return String(action)
}

function buildNextTodoCandidates(runs: ExecutionRun[]): NextTodoCandidate[] {
  return runs
    .filter((run) => Array.isArray(run.nextActions) && run.nextActions.length > 0)
    .slice(0, 10)
    .flatMap((run) =>
      run.nextActions.slice(0, 3).map((action) => ({
        sourceRunId: run.runId,
        targetApp: run.targetApp,
        title: nextActionText(action),
        reviewStatus: run.reviewStatus,
        createdAt: run.finishedAt,
      })),
    )
}

function isRiskyNextAction(title: string): boolean {
  return !classifyCodexEligibility(title).eligible && CODEX_DENY_SIGNALS.some((s) => title.toLowerCase().includes(s))
}

function inferPriority(title: string): TaskPriority {
  return isRiskyNextAction(title) ? 'high' : 'medium'
}

function slugForId(value: string): string {
  const ascii = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (ascii) return ascii.slice(0, 40)
  let hash = 0
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  }
  return hash.toString(36)
}

function findExistingTask(tasksData: ProjectTasksData, candidate: NextTodoCandidate): boolean {
  return tasksData.projects.some((project) =>
    project.tasks.some((task) =>
      (task.sourceRunId === candidate.sourceRunId && task.title === candidate.title) ||
      ((task.memo ?? '').includes(`sourceRunId:${candidate.sourceRunId}`) && task.title === candidate.title),
    ),
  )
}

export async function getNextActionCandidates(limit = 20): Promise<NextTodoCandidate[]> {
  const runsData = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
  const runs = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  return buildNextTodoCandidates(runs).slice(0, limit)
}

export async function generatePendingApprovalTasks(limit = 10): Promise<PendingTodoGenerationResult> {
  const [tasksData, candidates] = await Promise.all([
    readJson<ProjectTasksData>('project-tasks.json', { projects: [] }),
    getNextActionCandidates(limit),
  ])
  const now = new Date().toISOString()
  const taskIds: string[] = []
  let skipped = 0

  for (const candidate of candidates) {
    if (findExistingTask(tasksData, candidate)) {
      skipped++
      continue
    }

    const projectId = candidate.targetApp || 'company-meta'
    const taskId = `task-${projectId}-run-${candidate.sourceRunId}-${slugForId(candidate.title)}`
    const task: Task = {
      id: taskId,
      title: candidate.title,
      status: 'pending_approval',
      priority: inferPriority(candidate.title),
      assignee: 'both',
      preferredExecutor: isRiskyNextAction(candidate.title) ? 'manual' : 'claude',
      fallbackExecutor: isRiskyNextAction(candidate.title) ? undefined : 'codex',
      autoFallback: !isRiskyNextAction(candidate.title),
      canRunOnCodex: !isRiskyNextAction(candidate.title),
      requiresClaude: false,
      memo: `ExecutionRun nextActions から自動生成。sourceRunId:${candidate.sourceRunId}`,
      source: 'execution-run-next-actions',
      sourceRunId: candidate.sourceRunId,
      sourceType: 'execution_review',
      taskPrompt: [
        `ExecutionRun ${candidate.sourceRunId} の nextActions 由来ToDoです。`,
        'ユーザー承認前に着手しないでください。',
        `対象: ${candidate.targetApp}`,
        `内容: ${candidate.title}`,
      ].join('\n'),
      doneCriteria: ['ユーザーが承認または保留判断をする', '承認後に実行対象へ移す'],
      forbidden: ['pending_approval のまま実行しない', '未承認で queued にしない'],
      createdAt: now,
      updatedAt: now,
    }

    const project = tasksData.projects.find((p) => p.projectId === projectId)
    if (project) {
      project.tasks.push(task)
    } else {
      tasksData.projects.push({ projectId, tasks: [task] })
    }
    taskIds.push(taskId)
  }

  if (taskIds.length > 0) {
    await writeJson('project-tasks.json', tasksData)
  }

  return {
    created: taskIds.length,
    skipped,
    taskIds,
    candidates,
  }
}

// ---- Epic detail (read-only aggregation, no new source of truth) ----

function normalizeApp(value: string): string {
  return value.toLowerCase().split('/').map((s) => s.trim()).filter(Boolean).pop() ?? value.toLowerCase().trim()
}

/**
 * Run が Epic に属するかを判定する。優先順位:
 * 1) run.epicId が一致（executor がタグ付けした正確な結合）
 * 2) run.targetTodoId が epic.relatedTodoIds に含まれる
 * 3) run.runId === epic.latestRunId
 * 4) epic.targetApps に run.targetApp（正規化後）が含まれる
 */
function runBelongsToEpic(run: ExecutionRun, epic: Epic): boolean {
  if (run.epicId) return run.epicId === epic.epicId
  if (run.targetTodoId && epic.relatedTodoIds?.includes(run.targetTodoId)) return true
  if (epic.latestRunId && run.runId === epic.latestRunId) return true
  if (epic.targetApps && epic.targetApps.length > 0) {
    const apps = epic.targetApps.map(normalizeApp)
    if (apps.includes(normalizeApp(run.targetApp))) return true
  }
  return false
}

function epicHasScopeKeys(epic: Epic): boolean {
  return Boolean(
    (epic.relatedTodoIds && epic.relatedTodoIds.length > 0) ||
      (epic.targetApps && epic.targetApps.length > 0) ||
      epic.latestRunId,
  )
}

function toRunBrief(run: ExecutionRun): ExecutionRunBrief {
  return {
    runId: run.runId,
    finishedAt: run.finishedAt,
    targetApp: run.targetApp,
    targetTodoTitle: run.targetTodoTitle,
    runStatus: run.runStatus,
    reviewStatus: run.reviewStatus,
    summary: run.summary,
    executor: executorFromRun(run),
    changedFilesCount: run.changedFiles?.length ?? 0,
    nextActions: (run.nextActions ?? []).map(nextActionText),
  }
}

export async function getEpicDetail(epicId: string, recentLimit = 5): Promise<EpicDetail | null> {
  const epic = await getEpic(epicId)
  if (!epic) return null

  const [runsData, decisions, approvals, queue, tasksData] = await Promise.all([
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getOperationalDecisions(),
    getApprovals(),
    readJson<WorkQueueData>('work-queue.json', { items: [], lastGenerated: '' }),
    readJson<ProjectTasksData>('project-tasks.json', { projects: [] }),
  ])

  const sortedRuns = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))

  // ExecutionRun を Epic にスコープ。結合キーが未整備でマッチ 0 件なら、画面が空にならないよう
  // 全体の直近を 'global-fallback' として仮表示する（Run に epicId が付くにつれ自動で正確化する）。
  let scopedRuns = sortedRuns.filter((run) => runBelongsToEpic(run, epic))
  let runScope: EpicDetail['runScope'] = 'epic'
  if (scopedRuns.length === 0 && !epicHasScopeKeys(epic)) {
    scopedRuns = sortedRuns
    runScope = 'global-fallback'
  }

  const scopedDecisions = decisions.filter((d) => d.epicId === epic.epicId)
  const recentDecisions = (scopedDecisions.length > 0 ? scopedDecisions : []).slice(-recentLimit).reverse()
  const pendingApprovals = approvals
    .filter((a) => a.status === 'pending' && a.epicId === epic.epicId)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const nextActions = buildNextTodoCandidates(scopedRuns).slice(0, recentLimit)

  const tasks = tasksData.projects.flatMap((project) => project.tasks)
  const executors = summarizeExecutors(tasks, queue, scopedRuns)
  const running = queue.items.filter((item) => item.status === 'in_progress').length
  const stopped = queue.items.filter((item) => item.status === 'blocked').length

  return {
    epic,
    runScope,
    latestRun: scopedRuns[0] ? toRunBrief(scopedRuns[0]) : null,
    recentRuns: scopedRuns.slice(0, recentLimit).map(toRunBrief),
    recentDecisions,
    nextActions,
    pendingApprovals,
    automation: {
      executors,
      running,
      stopped,
      pendingApproval: pendingApprovals.length,
    },
    factoryEligibility: evaluateFactoryEligibility(epic, { pendingApprovalCount: pendingApprovals.length }),
  }
}

function summarizeHandoff(session: WorkSession) {
  const text = session.handoffText ?? ''
  const missingSections = HANDOFF_SECTIONS.filter((section) => !text.includes(section))
  return {
    exists: text.trim().length > 0 || Boolean(session.handoff),
    source: text.trim().length > 0 || session.handoff ? 'today-session' as const : 'none' as const,
    status: session.status,
    hasStructuredHandoff: Boolean(session.handoff),
    textLength: text.length,
    updatedAt: session.updatedAt,
    requiredSections: HANDOFF_SECTIONS,
    missingSections,
  }
}

export async function generateHandoffView(epicId?: string): Promise<GeneratedHandoff> {
  const [runsData, allDecisions, allApprovals, epic] = await Promise.all([
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getOperationalDecisions(),
    getPendingApprovals(),
    epicId ? getEpic(epicId) : Promise.resolve(null),
  ])

  // epicId 指定時は対象 Epic にスコープ。未指定 / 結合キー未整備時は全体を使う（従来挙動）。
  const sorted = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  let scopedRuns = sorted
  if (epic) {
    const matched = sorted.filter((run) => runBelongsToEpic(run, epic))
    if (matched.length > 0 || epicHasScopeKeys(epic)) scopedRuns = matched
  }
  const decisions = epic ? allDecisions.filter((d) => d.epicId === epic.epicId) : allDecisions
  const approvals = epic ? allApprovals.filter((a) => a.epicId === epic.epicId) : allApprovals
  const nextActions = buildNextTodoCandidates(scopedRuns).slice(0, 10)
  const latestRun = scopedRuns[0]
  const changedFiles = latestRun?.changedFiles.map((f) => `${f.file}${f.change ? `: ${f.change}` : ''}`) ?? []
  const decisionLines = decisions.slice(-10).map((d) => `${d.topic} => ${d.decision}`)
  const approvalLines = approvals.map((a) => `${a.title} (${a.priority})`)
  const forbidden = [
    'pending_approvalを未承認で実行しない',
    '外部公開・課金・秘密情報操作を自動実行しない',
    'handoffを独立した正本にしない',
  ]
  const checks = latestRun ? Object.entries(latestRun.checks).map(([k, v]) => `${k}: ${v}`) : []
  const remainingWork = [
    ...nextActions.slice(0, 5).map((a) => `${a.targetApp}: ${a.title}`),
    ...approvalLines.map((a) => `承認待ち: ${a}`),
  ]

  const handoff: GeneratedHandoff = {
    source: 'generated',
    objective: 'AI工場が止まらず再開できるよう、既存正本から次executorへ文脈を渡す',
    currentState: latestRun
      ? `最新ExecutionRun ${latestRun.runId}: ${latestRun.summary}`
      : 'ExecutionRunがまだありません',
    changedFiles,
    remainingWork,
    forbidden,
    checks,
    decisionLog: decisionLines,
    approvalsPending: approvalLines,
    nextActions,
    generatedAt: new Date().toISOString(),
    promptBlock: '',
  }

  handoff.promptBlock = [
    '# Handoff View（生成ビュー / 正本ではない）',
    '',
    `## 目的\n${handoff.objective}`,
    `## 現在地\n${handoff.currentState}`,
    `## 変更済みファイル\n${changedFiles.map((f) => `- ${f}`).join('\n') || '- なし'}`,
    `## 未完了作業\n${remainingWork.map((w) => `- ${w}`).join('\n') || '- なし'}`,
    `## 禁止事項\n${forbidden.map((f) => `- ${f}`).join('\n')}`,
    `## 検証条件\n${checks.map((c) => `- ${c}`).join('\n') || '- 未記録'}`,
    `## Decision Log\n${decisionLines.map((d) => `- ${d}`).join('\n') || '- なし'}`,
    `## 承認待ち事項\n${approvalLines.map((a) => `- ${a}`).join('\n') || '- なし'}`,
  ].join('\n\n')

  return handoff
}

// ---- Codex 引き継ぎプロンプト（半自動切替 / モバイルコピー用 / 単一プレーンテキスト） ----

// Codex 安全ガード。riskFlags 連動で deploy は「禁止」ではなく「注意」に回す（buildExecutionGuard と方針一致）。
// deploy のみは止めず実装〜検証〜必要な push まで進めてよい。課金/本番DB/認証/migration/destructive/外部公開は禁止のまま。
function codexSafetyGuard(riskFlags?: EpicRiskFlag[]): string[] {
  const guard = buildExecutionGuard(riskFlags)
  const lines = [
    '[1] まず安全判定',
    'この作業がCodexで安全に実行可能か判定してください。',
    'Codexで実行してよい作業: lint修正 / typecheck修正 / build修正 / test追加 / docs整理 / Vault整理 / Issue整理 / UI微修正 / 方針決定済み実装 / destructiveでない変更',
    'Codexで実行してはいけない作業: 課金 / 本番DB変更 / 認証情報利用 / secret・token・.env利用 / destructive操作 / 外部公開 / pm2・cron・systemd変更 / migration / 方針未決定設計 / Approval待ち / Decision待ち',
  ]
  for (const c of guard.cautions) lines.push(`注意（禁止ではない）: ${c}`)
  lines.push('上記の禁止に該当する場合は実行せず、blocked または approval_required として理由を報告してください。注意項目は止めず、進めた上で報告してください。')
  return lines
}

/**
 * Codex へ手動で引き継ぐためのコピペ用プロンプトを生成する。
 * 既存正本（ExecutionRun / Decision Log / Next Actions / Approval Queue / Epic / 変更ファイル / 未完了作業）を集約。
 * 出力は単一プレーンテキスト：markdown コードフェンス（```）も長い JSON も含めない（モバイルコピー用）。
 */
export async function generateCodexPrompt(epicId?: string): Promise<CodexPrompt> {
  const [runsData, allDecisions, allApprovals, epic] = await Promise.all([
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getOperationalDecisions(),
    getPendingApprovals(),
    epicId ? getEpic(epicId) : Promise.resolve(null),
  ])

  const sorted = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  let scopedRuns = sorted
  if (epic) {
    const matched = sorted.filter((run) => runBelongsToEpic(run, epic))
    if (matched.length > 0 || epicHasScopeKeys(epic)) scopedRuns = matched
  }
  const latestRun = scopedRuns[0]
  const decisions = epic ? allDecisions.filter((d) => d.epicId === epic.epicId) : allDecisions
  const approvals = epic ? allApprovals.filter((a) => a.epicId === epic.epicId) : allApprovals
  const nextActions = buildNextTodoCandidates(scopedRuns).slice(0, 5)
  const explicitNextActions = [
    epic?.nextAction,
    ...(epic?.remainingWork ?? []),
    ...nextActions.map((a) => a.title),
  ]
    .map((action) => action?.trim())
    .filter((action): action is string => Boolean(action))
    // 「具体的な次アクションを登録する」だけの循環指示は作業指示として再利用しない。
    .filter((action) => !/nextAction.*remainingWork|具体的.*nextAction/i.test(action))
  const dispatchNextActions = explicitNextActions.length > 0
    ? Array.from(new Set(explicitNextActions))
    : epic
      ? [
          `既存実装を調査し、DoneCriteria「${epic.doneCriteria?.[0] ?? 'Goal達成に必要な条件'}」を前進させる最小の未実装1件を特定して実装する。変更は1〜3ファイル程度に限定し、方針決定が必要なら変更せず理由を報告する`,
        ]
      : []
  const changedFiles = (latestRun?.changedFiles ?? []).map((f) => f.file).slice(0, 8)
  const targetApp = epic?.targetApps?.[0] ?? latestRun?.targetApp

  const lines: string[] = []
  lines.push('あなたはCodexです。以下はProgress（AI工場の管制塔）からの引き継ぎです。Claudeが上限で停止したため続きをお願いします。')
  lines.push('')
  lines.push(...codexSafetyGuard(epic?.riskFlags))
  lines.push('')
  lines.push('[2] 対象')
  if (epic) lines.push(`Epic: ${epic.title}（${epic.epicId}） 目標: ${epic.goal}`)
  if (targetApp) lines.push(`対象アプリ: ${targetApp}`)
  lines.push(`直近の作業: ${latestRun ? `${latestRun.summary}（runId ${latestRun.runId}）` : 'なし'}`)
  lines.push(`変更済みファイル: ${changedFiles.length > 0 ? changedFiles.join(' , ') : 'なし'}`)
  lines.push('')
  lines.push('[3] 決定事項（これに反する作業はしない）')
  lines.push(decisions.length > 0 ? decisions.slice(-5).map((d) => `- ${d.topic} → ${d.decision}`).join('\n') : '- なし')
  lines.push('')
  lines.push('[4] 承認待ち（これには触らない。未承認の作業はしない）')
  lines.push(approvals.length > 0 ? approvals.map((a) => `- ${a.title}（${a.priority}）`).join('\n') : '- なし')
  lines.push('')
  // 人間がレビューで「修正する」と判断し登録した修正指示（needs_followup Run の fixPrompt / 承認済み修正依頼）を最優先で渡す。
  const humanFixInstructions = Array.from(new Set([
    ...scopedRuns
      .filter((r) => r.reviewStatus === 'needs_followup' && !!r.fixPrompt && r.fixPrompt.trim().length > 0)
      .sort((a, b) => Date.parse(b.fixRequestedAt || b.finishedAt || b.startedAt) - Date.parse(a.fixRequestedAt || a.finishedAt || a.startedAt))
      .map((r) => r.fixPrompt!.trim()),
    ...((epic?.remainingWork ?? []).filter((w) => /修正指示|人間の修正/.test(w)).map((w) => w.trim())),
  ]))
  if (humanFixInstructions.length > 0) {
    lines.push('[4-1] 人間の修正指示（最優先で対応すること）')
    lines.push('人間がレビューで「修正する」と判断し登録した指示です。元作業を確認し、以下を最優先で反映してください。')
    lines.push(humanFixInstructions.map((f) => `- ${f}`).join('\n'))
    lines.push('')
  }
  lines.push('[5] 次にやること（安全判定OKのものだけ）')
  lines.push(dispatchNextActions.length > 0 ? dispatchNextActions.map((action) => `- ${action}`).join('\n') : '- なし')
  lines.push('')
  lines.push('[6] 進め方')
  lines.push('- 安全判定OKの作業だけ実行する')
  lines.push('- build / lint / typecheck まで検証を通す')
  lines.push('- 完了したら作業報告を簡潔にまとめる（変更ファイル / 実行コマンド / 検証結果 / 次アクション / 残課題）')
  lines.push('')
  lines.push('[7] 完了後')
  lines.push('作業報告（変更ファイル / 実行コマンド / 検証結果 / 次アクション）をそのままユーザーへ返してください。')
  lines.push('ユーザーが Progress の「Codex結果を戻す」に貼り、executorUsed=codex / source=codex_mobile として ExecutionRun に登録します。')

  return {
    promptText: lines.join('\n'),
    meta: {
      epicId: epic?.epicId,
      epicTitle: epic?.title,
      sourceRunId: latestRun?.runId,
      targetApp,
      nextActionsCount: dispatchNextActions.length,
      approvalsPending: approvals.length,
      hasSafetyGuard: true,
      generatedAt: new Date().toISOString(),
    },
  }
}

export async function computeAutomationReadiness(): Promise<AutomationReadiness> {
  const [queue, tasksData, runsData, approvals, decisions, session] = await Promise.all([
    readJson<WorkQueueData>('work-queue.json', { items: [], lastGenerated: '' }),
    readJson<ProjectTasksData>('project-tasks.json', { projects: [] }),
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getPendingApprovals(),
    getOperationalDecisions(),
    readJson<WorkSession>('today-session.json', {
      date: '',
      status: 'pending',
      handoffText: '',
      createdAt: '',
      updatedAt: '',
    }),
  ])

  const tasks = tasksData.projects.flatMap((project) => project.tasks)
  const runs = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  const candidates = buildNextTodoCandidates(runs)
  const codexRunnable = tasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status) && canRunOnCodex(task)).length
  const pendingCritical = approvals.filter((a) => a.priority === 'critical').length
  const pendingHigh = approvals.filter((a) => a.priority === 'high').length
  const mobileSelectable = approvals.filter((a) => a.options.length >= 2 && a.options.length <= 4 && Boolean(a.recommended)).length
  const blockers: string[] = []

  if (approvals.length > 0) blockers.push('pending approvals exist')
  if (queue.items.filter((item) => item.status === 'queued' || item.status === 'in_progress').length === 0) {
    blockers.push('no queued or running work items')
  }
  if (decisions.length === 0) blockers.push('decision log is empty')
  if (!session.handoffText && !session.handoff) blockers.push('handoff is empty')

  return {
    vloopSourceOfTruth: 'Vault: 20_reviews/案件別ToDo一覧.md',
    executionTarget: 'Vault: 20_reviews/vloop_queue.md + Progress work-queue queued/in_progress',
    approvalQueue: {
      pending: approvals.length,
      critical: pendingCritical,
      high: pendingHigh,
      mobileSelectable,
    },
    decisionLog: {
      entries: decisions.length,
      latestDecisionAt: decisions.at(-1)?.decidedAt,
    },
    aiGeneratedTodos: {
      fromExecutionRunNextActions: candidates.length,
      persistedAsTasks: tasks.filter((task) => (task.memo ?? '').includes('sourceRunId') || (task.taskPrompt ?? '').includes('sourceRunId')).length,
      candidates,
    },
    executors: summarizeExecutors(tasks, queue, runs),
    handoff: summarizeHandoff(session),
    generatedHandoff: {
      available: runs.length > 0 || decisions.length > 0 || candidates.length > 0 || approvals.length > 0,
      source: 'ExecutionRun + Decision Log + nextActions + Approval Queue',
      nextActions: candidates.length,
      pendingApprovals: approvals.length,
    },
    restartReadiness: {
      canResumeFromQueue: queue.items.some((item) => item.status === 'queued' || item.status === 'in_progress'),
      canResumeFromDecisionLog: decisions.length > 0,
      canFallbackToCodex: codexRunnable > 0,
      blockers,
    },
  }
}

// ---- Automation config (運用スイッチの永続化。新正本ではなく設定ファイル) ----

const DEFAULT_AUTOMATION_CONFIG: AutomationConfig = {
  executorMode: 'both',
  autoResume: false,
  autoFallback: false,
  factoryEnabled: false,
  factoryMaxPerEpic: 3,
  updatedAt: '',
}

/** factoryMaxPerEpic は 1〜3 にクランプする（無限ループ防止の安全上限は維持）。 */
function clampMaxPerEpic(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 3
  return Math.max(1, Math.min(n, 3))
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  const stored = await readJson<Partial<AutomationConfig>>('automation-config.json', DEFAULT_AUTOMATION_CONFIG)
  // 旧 config に新フィールド（factoryEnabled / factoryMaxPerEpic 等）が無くても既定で補完する。
  const merged = { ...DEFAULT_AUTOMATION_CONFIG, ...stored }
  merged.factoryMaxPerEpic = clampMaxPerEpic(merged.factoryMaxPerEpic)
  return merged
}

export async function updateAutomationConfig(
  patch: Partial<Omit<AutomationConfig, 'updatedAt'>>,
): Promise<AutomationConfig> {
  const current = await getAutomationConfig()
  const next: AutomationConfig = {
    executorMode: patch.executorMode ?? current.executorMode,
    autoResume: patch.autoResume ?? current.autoResume,
    autoFallback: patch.autoFallback ?? current.autoFallback,
    factoryEnabled: patch.factoryEnabled ?? current.factoryEnabled,
    factoryMaxPerEpic: clampMaxPerEpic(patch.factoryMaxPerEpic ?? current.factoryMaxPerEpic),
    updatedAt: new Date().toISOString(),
  }
  await writeJson('automation-config.json', next)
  if (typeof patch.factoryEnabled === 'boolean' && patch.factoryEnabled !== current.factoryEnabled) {
    await recordOperationalDecision({
      action: patch.factoryEnabled ? 'factory_resume' : 'factory_pause',
      topic: 'Factory ON/OFF 切替',
      decision: `factoryEnabled=${patch.factoryEnabled}`,
    })
  }
  return next
}

// ---- Auto Fallback（Claude 上限時の半自動 Codex 引き継ぎ）----
// Codex は自動起動しない。安全判定 OK のときだけプロンプトを生成して通知する。

/** Epic にスコープした未完了タスク（targetApps / relatedTodoIds で結合）。 */
async function getScopedOpenTasks(epic: Epic | null): Promise<Task[]> {
  const tasksData = await readJson<ProjectTasksData>('project-tasks.json', { projects: [] })
  const all = tasksData.projects.flatMap((p) =>
    p.tasks.map((t) => ({ projectId: p.projectId, task: t })),
  )
  return all
    .filter(({ projectId, task }) => {
      if (!OPEN_TASK_STATUSES.includes(task.status) && task.status !== 'pending_approval') return false
      if (!epic) return true
      if (epic.relatedTodoIds?.includes(task.id)) return true
      if ((epic.targetApps ?? []).map(normalizeApp).includes(normalizeApp(projectId))) return true
      return false
    })
    .map(({ task }) => task)
}

/**
 * Claude 上限扱いになったときに Codex へ安全に引き継げるかを厳格判定する。
 * 優先順: Auto Fallback設定 → 承認待ち → 決定待ち(decisionPolicy) → 対象作業の承認待ち
 *        → requiresClaude → キーワード deny/allow（補助）。文字列判定は最後。
 */
export async function evaluateAutoFallback(
  epicId?: string,
  reason = 'claude_rate_limited',
): Promise<AutoFallbackResult> {
  const now = new Date().toISOString()
  const [config, epic] = await Promise.all([
    getAutomationConfig(),
    epicId ? getEpic(epicId) : Promise.resolve(null),
  ])
  const blocked: FallbackBlock[] = []

  // 0) 設定ゲート
  if (!config.autoFallback) {
    blocked.push({ kind: 'disabled', reason: 'Auto Fallback が OFF です（Automation で ON にしてください）' })
  }
  if (config.executorMode !== 'both' && config.executorMode !== 'codex') {
    blocked.push({ kind: 'disabled', reason: `executorMode が ${config.executorMode}（Codex fallback 不可）` })
  }

  // 1) 承認待ち（最優先ゲート）
  const allPending = await getPendingApprovals()
  const pending = epic ? allPending.filter((a) => a.epicId === epic.epicId) : allPending
  if (pending.length > 0) {
    blocked.push({ kind: 'approval_required', reason: `承認待ち ${pending.length} 件があるため Codex へ渡しません` })
  }

  // 2) 決定待ち（decisionPolicy が autonomous 以外なら人間判断が必要）
  if (epic && epic.decisionPolicy !== 'autonomous') {
    blocked.push({ kind: 'decision_required', reason: `Epic の decisionPolicy が ${epic.decisionPolicy}（決定待ち）` })
  }

  // 3) 対象作業のメタデータ（承認待ち status / requiresClaude）
  const openTasks = await getScopedOpenTasks(epic)
  if (openTasks.some((t) => t.status === 'pending_approval')) {
    blocked.push({ kind: 'requires_approval', reason: '対象作業に承認待ち(pending_approval)があります' })
  }
  if (openTasks.some((t) => t.requiresClaude)) {
    blocked.push({ kind: 'requires_claude', reason: '対象作業に Claude 専任(requiresClaude)があります' })
  }

  // 4) 次アクションのキーワード判定（補助・最後）
  const runsData = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
  const sorted = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  let scopedRuns = sorted
  if (epic) {
    const matched = sorted.filter((run) => runBelongsToEpic(run, epic))
    if (matched.length > 0 || epicHasScopeKeys(epic)) scopedRuns = matched
  }
  const candidates = buildNextTodoCandidates(scopedRuns).slice(0, 10)
  const denyHits = candidates.filter((c) => {
    const e = classifyCodexEligibility(c.title)
    return !e.eligible && CODEX_DENY_SIGNALS.some((s) => c.title.toLowerCase().includes(s))
  })
  const eligible = candidates.filter((c) => classifyCodexEligibility(c.title).eligible)
  if (candidates.length === 0) {
    blocked.push({ kind: 'no_codex_candidate', reason: 'Codex へ渡せる次アクションがありません' })
  } else if (eligible.length === 0) {
    blocked.push(
      denyHits.length > 0
        ? { kind: 'destructive', reason: `危険シグナルを含む作業のみのため Codex へ渡しません（${denyHits.length} 件）` }
        : { kind: 'no_codex_candidate', reason: '安全判定 OK の次アクションが残っていません' },
    )
  }

  const isBlocked = blocked.length > 0
  let prompt: CodexPrompt | undefined
  if (!isBlocked) {
    prompt = await generateCodexPrompt(epicId)
  }

  return {
    triggered: true,
    status: isBlocked ? 'blocked' : 'codex_ready',
    fallbackReason: reason,
    fallbackTarget: 'codex',
    safetyGuard: true,
    codexPromptGenerated: Boolean(prompt),
    codexPromptSourceRunId: prompt?.meta.sourceRunId,
    epicId: epic?.epicId,
    epicTitle: epic?.title,
    blocked,
    prompt,
    evaluatedAt: now,
  }
}

// ---- Automation Log（追記専用イベントログ。新しい正本ではなく運用ログ）----

export async function appendAutomationLog(entry: Omit<AutomationLogEntry, 'id' | 'at'>): Promise<AutomationLogEntry> {
  const full: AutomationLogEntry = { id: `alog-${Date.now()}`, at: new Date().toISOString(), ...entry }
  await appendNdjson('automation-log.ndjson', full)
  return full
}

export async function getAutomationLog(limit = 20): Promise<AutomationLogEntry[]> {
  const all = await readNdjson<AutomationLogEntry>('automation-log.ndjson')
  return all.slice(-limit).reverse()
}

/** Claude 上限自動検知の結果を Automation Log（追記専用）へ記録する。検知の足跡を正本に残す。 */
export async function appendDetectionLog(detection: ClaudeLimitDetection): Promise<AutomationLogEntry> {
  const full: AutomationLogEntry = {
    id: `alog-${Date.now()}`,
    at: new Date().toISOString(),
    event: 'claude_limit_detection',
    fallbackReason: detection.reason,
    detectionStatus: detection.status,
    detectionConfidence: detection.confidence,
    detectionRecommendation: detection.recommendation,
    signalCount: detection.signals.length,
    signalSources: Array.from(new Set(detection.signals.map((s) => s.source))),
  }
  await appendNdjson('automation-log.ndjson', full)
  return full
}

/** 評価 → Automation Log 追記 → 結果返却。API から呼ぶ入口。 */
export async function triggerAutoFallback(epicId?: string, reason = 'claude_rate_limited'): Promise<AutoFallbackResult> {
  const result = await evaluateAutoFallback(epicId, reason)
  await appendAutomationLog({
    event: 'auto_fallback',
    fallbackTriggered: result.triggered,
    fallbackReason: result.fallbackReason,
    fallbackTarget: result.fallbackTarget,
    codexPromptGenerated: result.codexPromptGenerated,
    codexPromptSourceRunId: result.codexPromptSourceRunId,
    safetyGuard: result.safetyGuard,
    blockedReason: result.blocked.map((b) => b.kind).join(',') || undefined,
    epicId: result.epicId,
  })
  return result
}
