import fs from 'fs/promises'
import path from 'path'
import type {
  AppProgress,
  Project,
  ProjectTasksData,
  WorkLogEntry,
  NewTaskInput,
  Task,
  TaskStatus,
  TaskAssignee,
  TaskPriority,
  ProjectSummaryUpdate,
  NewProjectInput,
  ProjectStatus,
} from '@/types/progress'
import { getDataPath } from '@/lib/progress-reader'

// task が done になった後、次の Claude 着手候補を導出する
function computeNextActionFromTasks(tasks: Task[]): string {
  const PRIORITY_ORDER: Partial<Record<TaskPriority, number>> = { high: 0, medium: 1, low: 2 }
  const OPEN_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'impl_done', 'local_done']

  const claudeEligible = tasks
    .filter((t) => {
      const isOpen = (OPEN_STATUSES as string[]).includes(t.status)
      const assignee = t.assignee ?? 'claude'
      return isOpen && (assignee === 'claude' || assignee === 'both')
    })
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9))

  if (claudeEligible.length > 0) return claudeEligible[0].title

  const userPending = tasks.filter((t) => {
    const isOpen = (OPEN_STATUSES as string[]).includes(t.status)
    return isOpen && t.assignee === 'user'
  })

  if (userPending.length > 0) {
    return `ユーザー操作待ち: ${userPending.map((t) => t.title).join(' / ')}`
  }

  return '完了'
}

export async function addTask(input: NewTaskInput): Promise<string> {
  const { projectId, title, status, priority, memo, assignee = 'claude' } = input
  const filePath = path.join(getDataPath(), 'project-tasks.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as ProjectTasksData

  const taskId = `task-${projectId}-${Date.now()}`
  const now = new Date().toISOString()
  const newTask = buildNewTask(input, taskId, now)

  const project = data.projects.find((p) => p.projectId === projectId)
  if (project) {
    project.tasks.push(newTask)
  } else {
    data.projects.push({ projectId, tasks: [newTask] })
  }

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  await appendWorkLog({ time: now, project: projectId, type: 'task_added', title, detail: `priority:${priority} status:${status} assignee:${assignee}` })
  return taskId
}

function buildNewTask(input: NewTaskInput, taskId: string, now: string): Task {
  const {
    goalId,
    phaseId,
    title,
    status,
    priority,
    memo,
    source,
    sourceRunId,
    sourceType,
    assignee = 'claude',
    taskPrompt,
    doneCriteria,
    allowed,
    forbidden,
    risk,
    blockedReason,
    unblockAction,
    nextQuestion,
    targetPath,
    targetApp,
    preferredExecutor,
    fallbackExecutor,
    autoFallback,
    canRunOnCodex,
    requiresClaude,
  } = input

  return {
    id: taskId,
    ...(goalId ? { goalId } : {}),
    ...(phaseId ? { phaseId } : {}),
    title,
    status,
    priority,
    assignee,
    ...(preferredExecutor ? { preferredExecutor } : {}),
    ...(fallbackExecutor ? { fallbackExecutor } : {}),
    ...(typeof autoFallback === 'boolean' ? { autoFallback } : {}),
    ...(typeof canRunOnCodex === 'boolean' ? { canRunOnCodex } : {}),
    ...(typeof requiresClaude === 'boolean' ? { requiresClaude } : {}),
    memo,
    ...(source ? { source } : {}),
    ...(sourceRunId ? { sourceRunId } : {}),
    ...(sourceType ? { sourceType } : {}),
    ...(taskPrompt ? { taskPrompt, taskPromptUpdatedAt: now, taskPromptUpdatedBy: 'user' as const } : {}),
    ...(doneCriteria ? { doneCriteria } : {}),
    ...(allowed ? { allowed } : {}),
    ...(forbidden ? { forbidden } : {}),
    ...(risk ? { risk } : {}),
    ...(blockedReason ? { blockedReason } : {}),
    ...(unblockAction ? { unblockAction } : {}),
    ...(nextQuestion ? { nextQuestion } : {}),
    ...(targetPath ? { targetPath } : {}),
    ...(targetApp ? { targetApp } : {}),
    createdAt: now,
    updatedAt: now,
  }
}

export async function addTasks(inputs: NewTaskInput[]): Promise<string[]> {
  if (inputs.length === 0) return []

  const filePath = path.join(getDataPath(), 'project-tasks.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as ProjectTasksData
  const now = new Date().toISOString()
  const taskIds: string[] = []
  const logGroups = new Map<string, string[]>()

  inputs.forEach((input, index) => {
    const taskId = `task-${input.projectId}-${Date.now()}-${index}`
    const newTask = buildNewTask(input, taskId, now)
    const project = data.projects.find((p) => p.projectId === input.projectId)

    if (project) {
      project.tasks.push(newTask)
    } else {
      data.projects.push({ projectId: input.projectId, tasks: [newTask] })
    }

    taskIds.push(taskId)
    const titles = logGroups.get(input.projectId) ?? []
    titles.push(input.title)
    logGroups.set(input.projectId, titles)
  })

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

  for (const [projectId, titles] of Array.from(logGroups.entries())) {
    await appendWorkLog({
      time: now,
      project: projectId,
      type: 'task_added',
      title: `タスク一括追加 ${titles.length}件`,
      detail: titles.join(' / '),
    })
  }

  return taskIds
}

// task が done になると同ステップで app-progress.json の nextAction を自動更新する
export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  status: TaskStatus,
  options?: { nextActionOverride?: string; assignee?: TaskAssignee }
): Promise<void> {
  const filePath = path.join(getDataPath(), 'project-tasks.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as ProjectTasksData

  const project = data.projects.find((p) => p.projectId === projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const prevStatus = task.status
  task.status = status
  task.updatedAt = new Date().toISOString()
  if (options?.assignee !== undefined) task.assignee = options.assignee

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

  const detailParts = [`${prevStatus} → ${status}`]
  if (options?.assignee !== undefined) detailParts.push(`assignee:${options.assignee}`)
  await appendWorkLog({
    time: new Date().toISOString(),
    project: projectId,
    type: 'task_status_updated',
    title: task.title,
    detail: detailParts.join(' / '),
  })

  // 優先1: done への遷移時に nextAction を原子的に更新する
  if (status === 'done') {
    const nextAction = options?.nextActionOverride ?? computeNextActionFromTasks(project.tasks)
    await updateProjectSummary(projectId, { nextAction })
  }
}

export async function updateTask(
  projectId: string,
  taskId: string,
  updates: {
    title?: string
    goalId?: string
    phaseId?: string
    status?: TaskStatus
    priority?: TaskPriority
    assignee?: TaskAssignee
    memo?: string
    taskPrompt?: string
    doneCriteria?: string[]
    allowed?: string[]
    forbidden?: string[]
    risk?: string
    blockedReason?: string
    unblockAction?: string
    nextQuestion?: string
    targetPath?: string
    targetApp?: string
    source?: string
    sourceRunId?: string
    sourceType?: Task['sourceType']
    preferredExecutor?: Task['preferredExecutor']
    fallbackExecutor?: Task['fallbackExecutor']
    autoFallback?: boolean
    canRunOnCodex?: boolean
    requiresClaude?: boolean
  }
): Promise<void> {
  const filePath = path.join(getDataPath(), 'project-tasks.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as ProjectTasksData

  const project = data.projects.find((p) => p.projectId === projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const now = new Date().toISOString()
  const changes: string[] = []
  if (updates.goalId !== undefined) task.goalId = updates.goalId
  if (updates.phaseId !== undefined) task.phaseId = updates.phaseId
  if (updates.title !== undefined && updates.title !== task.title) { changes.push(`title`); task.title = updates.title }
  if (updates.status !== undefined && updates.status !== task.status) { changes.push(`status: ${task.status} → ${updates.status}`); task.status = updates.status }
  if (updates.priority !== undefined && updates.priority !== task.priority) { changes.push(`priority: ${task.priority} → ${updates.priority}`); task.priority = updates.priority }
  if (updates.assignee !== undefined && updates.assignee !== task.assignee) { changes.push(`assignee: ${task.assignee} → ${updates.assignee}`); task.assignee = updates.assignee }
  if (updates.memo !== undefined) task.memo = updates.memo
  if (updates.taskPrompt !== undefined) { task.taskPrompt = updates.taskPrompt; task.taskPromptUpdatedAt = now; task.taskPromptUpdatedBy = 'user' }
  if (updates.doneCriteria !== undefined) task.doneCriteria = updates.doneCriteria
  if (updates.allowed !== undefined) task.allowed = updates.allowed
  if (updates.forbidden !== undefined) task.forbidden = updates.forbidden
  if (updates.risk !== undefined) task.risk = updates.risk
  if (updates.blockedReason !== undefined) task.blockedReason = updates.blockedReason
  if (updates.unblockAction !== undefined) task.unblockAction = updates.unblockAction
  if (updates.nextQuestion !== undefined) task.nextQuestion = updates.nextQuestion
  if (updates.targetPath !== undefined) task.targetPath = updates.targetPath
  if (updates.targetApp !== undefined) task.targetApp = updates.targetApp
  if (updates.source !== undefined) task.source = updates.source
  if (updates.sourceRunId !== undefined) task.sourceRunId = updates.sourceRunId
  if (updates.sourceType !== undefined) task.sourceType = updates.sourceType
  if (updates.preferredExecutor !== undefined) { changes.push(`preferredExecutor: ${task.preferredExecutor ?? ''} → ${updates.preferredExecutor}`); task.preferredExecutor = updates.preferredExecutor }
  if (updates.fallbackExecutor !== undefined) { changes.push(`fallbackExecutor: ${task.fallbackExecutor ?? ''} → ${updates.fallbackExecutor}`); task.fallbackExecutor = updates.fallbackExecutor }
  if (updates.autoFallback !== undefined) task.autoFallback = updates.autoFallback
  if (updates.canRunOnCodex !== undefined) task.canRunOnCodex = updates.canRunOnCodex
  if (updates.requiresClaude !== undefined) task.requiresClaude = updates.requiresClaude
  task.updatedAt = now

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

  if (changes.length > 0) {
    await appendWorkLog({ time: now, project: projectId, type: 'task_status_updated', title: task.title, detail: changes.join(' / ') })
  }

  if (updates.status === 'done') {
    const nextAction = computeNextActionFromTasks(project.tasks)
    await updateProjectSummary(projectId, { nextAction })
  }
}

export async function updateTaskPrompt(
  projectId: string,
  taskId: string,
  taskPrompt: string
): Promise<void> {
  const filePath = path.join(getDataPath(), 'project-tasks.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as ProjectTasksData

  const project = data.projects.find((p) => p.projectId === projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const task = project.tasks.find((t) => t.id === taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const now = new Date().toISOString()
  task.taskPrompt = taskPrompt
  task.taskPromptUpdatedAt = now
  task.taskPromptUpdatedBy = 'user'
  task.updatedAt = now

  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function updateProjectSummary(projectId: string, updates: ProjectSummaryUpdate): Promise<void> {
  const filePath = path.join(getDataPath(), 'app-progress.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as AppProgress

  const project = data.projects.find((p) => p.id === projectId)
  if (!project) throw new Error(`Project not found: ${projectId}`)

  const summaryChanges: string[] = []
  let blockersChanged = false

  if (updates.currentTask !== undefined && updates.currentTask !== project.currentTask) {
    summaryChanges.push(`currentTask → "${updates.currentTask}"`)
    project.currentTask = updates.currentTask
  }
  if (updates.nextAction !== undefined && updates.nextAction !== project.nextAction) {
    summaryChanges.push(`nextAction → "${updates.nextAction}"`)
    project.nextAction = updates.nextAction
  }
  if (updates.progress !== undefined) {
    const clamped = Math.max(0, Math.min(100, Math.round(updates.progress)))
    if (clamped !== project.progress) {
      summaryChanges.push(`progress: ${project.progress} → ${clamped}`)
      project.progress = clamped
    }
  }
  if (updates.status !== undefined && updates.status !== project.status) {
    summaryChanges.push(`status: ${project.status} → ${updates.status}`)
    project.status = updates.status
  }
  if (updates.phase !== undefined && updates.phase !== project.phase) {
    summaryChanges.push(`phase → "${updates.phase}"`)
    project.phase = updates.phase
  }
  if (updates.url !== undefined && updates.url !== (project.url ?? '')) {
    summaryChanges.push(`url → "${updates.url}"`)
    project.url = updates.url || undefined
  }
  if (updates.blockers !== undefined) {
    const prev = JSON.stringify(project.blockers)
    const next = JSON.stringify(updates.blockers)
    if (prev !== next) {
      blockersChanged = true
      project.blockers = updates.blockers
    }
  }
  if (updates.excluded !== undefined && updates.excluded !== (project.excluded ?? false)) {
    summaryChanges.push(`excluded: ${project.excluded ?? false} → ${updates.excluded}`)
    project.excluded = updates.excluded
  }

  project.updatedAt = new Date().toISOString()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

  const now = new Date().toISOString()
  if (summaryChanges.length > 0) {
    await appendWorkLog({ time: now, project: projectId, type: 'project_summary_updated', title: `${project.name} サマリー更新`, detail: summaryChanges.join(' / ') })
  }
  if (blockersChanged && summaryChanges.length === 0) {
    const count = project.blockers.length
    await appendWorkLog({ time: now, project: projectId, type: 'blockers_updated', title: `${project.name} ブロッカー更新`, detail: `${count} 件` })
  }
}

export async function addProject(input: NewProjectInput): Promise<void> {
  const filePath = path.join(getDataPath(), 'app-progress.json')
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content) as AppProgress

  if (data.projects.some((p) => p.id === input.id)) {
    throw new Error(`DUPLICATE_ID: ${input.id}`)
  }

  const now = new Date().toISOString()
  const newProject: Project = {
    id: input.id,
    name: input.name,
    status: input.status,
    phase: input.phase,
    progress: Math.max(0, Math.min(100, Math.round(input.progress))),
    currentTask: input.currentTask,
    nextAction: input.nextAction,
    blockers: [],
    url: input.url || undefined,
    updatedAt: now,
  }

  data.projects.push(newProject)
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
  await appendWorkLog({ time: now, project: input.id, type: 'project_added', title: `${input.name} 追加`, detail: `status:${input.status} phase:${input.phase}` })
}

async function appendWorkLog(entry: WorkLogEntry): Promise<void> {
  const filePath = path.join(getDataPath(), 'work-log.ndjson')
  await fs.appendFile(filePath, JSON.stringify(entry) + '\n', 'utf-8')
}
