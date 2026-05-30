import { readJson, writeJson, appendNdjson, readNdjson } from './store'
import type {
  Epic,
  Approval,
  ApprovalPriority,
  OperationalDecision,
  HealthSummary,
  AutomationReadiness,
  ExecutorSummary,
  ExecutorType,
  NextTodoCandidate,
} from './types/operations'
import type { WorkQueueData } from '@/types/session'
import type { AppProgress, ProjectTasksData, Task } from '@/types/progress'
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

export async function updateEpic(epicId: string, patch: Partial<Epic>): Promise<Epic | null> {
  const epics = await getEpics()
  const idx = epics.findIndex((e) => e.epicId === epicId)
  if (idx === -1) return null
  const updated: Epic = { ...epics[idx], ...patch, epicId }
  epics[idx] = updated
  await writeJson('epics.json', epics)
  return updated
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
  }
  await appendNdjson('operational-decisions.ndjson', decision)

  return decided
}

// ---- Operational decisions ----

export async function getOperationalDecisions(): Promise<OperationalDecision[]> {
  return readNdjson<OperationalDecision>('operational-decisions.ndjson')
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
  const text = `${task.title} ${task.memo} ${task.taskPrompt ?? ''}`.toLowerCase()
  const safeSignals = ['lint', 'typecheck', 'build', 'test', 'document', 'docs', 'vault', 'github issue', 'ui', 'copy']
  const riskySignals = ['課金', '本番db', 'destructive', 'secret', 'token', '外部公開', '認証情報', 'production']
  return safeSignals.some((s) => text.includes(s)) && !riskySignals.some((s) => text.includes(s))
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

function buildNextTodoCandidates(runs: ExecutionRun[]): NextTodoCandidate[] {
  return runs
    .filter((run) => run.nextActions.length > 0)
    .slice(0, 10)
    .flatMap((run) =>
      run.nextActions.slice(0, 3).map((action) => ({
        sourceRunId: run.runId,
        targetApp: run.targetApp,
        title: action,
        reviewStatus: run.reviewStatus,
        createdAt: run.finishedAt,
      })),
    )
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
    restartReadiness: {
      canResumeFromQueue: queue.items.some((item) => item.status === 'queued' || item.status === 'in_progress'),
      canResumeFromDecisionLog: decisions.length > 0,
      canFallbackToCodex: codexRunnable > 0,
      blockers,
    },
  }
}
