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
} from './types/operations'
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

function isRiskyNextAction(title: string): boolean {
  const text = title.toLowerCase()
  const riskySignals = ['課金', '本番db', 'destructive', 'secret', 'token', '外部公開', '認証情報', 'production', 'pm2', 'cron', 'systemd']
  return riskySignals.some((signal) => text.includes(signal))
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

export async function generateHandoffView(): Promise<GeneratedHandoff> {
  const [runsData, decisions, approvals, nextActions] = await Promise.all([
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getOperationalDecisions(),
    getPendingApprovals(),
    getNextActionCandidates(10),
  ])
  const latestRun = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))[0]
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
