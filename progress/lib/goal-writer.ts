import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import { readGoals } from '@/lib/goal-reader'
import { addTasks } from '@/lib/progress-writer'
import { addTaskDirectlyToQueue } from '@/lib/session-writer'
import type {
  Goal,
  GoalImportInput,
  GoalImportInputPhase,
  GoalImportInputTodo,
  GoalPhase,
  GoalRole,
  GoalTodo,
  GoalsData,
  GoalStatus,
  GoalUpsertInput,
  MonetizationImpact,
} from '@/types/goal'
import type { NewTaskInput, TaskAssignee, TaskPriority } from '@/types/progress'

const VALID_ROLES: GoalRole[] = ['human', 'claude', 'codex']
const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const VALID_IMPACT: MonetizationImpact[] = ['high', 'medium', 'low', 'none']
const VALID_GOAL_STATUS: GoalStatus[] = ['active', 'paused', 'done', 'dropped', 'archived']

function nowIso(): string {
  return new Date().toISOString()
}

function genId(prefix: string): string {
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 7)
  return `${prefix}-${t}-${r}`
}

export async function writeGoals(data: GoalsData): Promise<void> {
  const filePath = path.join(getDataPath(), 'goals.json')
  data.updatedAt = nowIso()
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function pickGoalStatus(value: unknown, fallback: GoalStatus = 'active'): GoalStatus {
  return VALID_GOAL_STATUS.includes(value as GoalStatus) ? (value as GoalStatus) : fallback
}

function pickNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return fallback
}

function pickPriority(value: unknown, fallback: TaskPriority = 'medium'): TaskPriority {
  return VALID_PRIORITIES.includes(value as TaskPriority) ? (value as TaskPriority) : fallback
}

function pickRole(value: unknown, fallback: GoalRole = 'claude'): GoalRole {
  return VALID_ROLES.includes(value as GoalRole) ? (value as GoalRole) : fallback
}

function pickImpact(value: unknown, fallback: MonetizationImpact = 'none'): MonetizationImpact {
  return VALID_IMPACT.includes(value as MonetizationImpact) ? (value as MonetizationImpact) : fallback
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

export interface GoalImportValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
  phaseCount: number
  todoCount: number
  perRole: Record<GoalRole, number>
}

export function validateGoalImport(input: unknown, projects: { id: string; name: string }[]): GoalImportValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const perRole: Record<GoalRole, number> = { human: 0, claude: 0, codex: 0 }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['JSONはオブジェクト形式である必要があります'], warnings: [], phaseCount: 0, todoCount: 0, perRole }
  }

  const obj = input as Record<string, unknown>
  const projectId = pickString(obj.projectId)
  const goalTitle = pickString(obj.goalTitle)

  if (!projectId) errors.push('projectId は必須です')
  else if (!projects.some((p) => p.id === projectId)) {
    errors.push(`projectId "${projectId}" が既存案件に見つかりません`)
  }
  if (!goalTitle) errors.push('goalTitle は必須です')

  const phasesRaw = Array.isArray(obj.phases) ? obj.phases : []
  const todosRaw = Array.isArray(obj.todos) ? obj.todos : []

  if (phasesRaw.length === 0) errors.push('phases は1件以上必要です')
  if (todosRaw.length === 0) errors.push('todos は1件以上必要です')

  const phaseTitleSet = new Set<string>()
  const phaseIdSet = new Set<string>()
  phasesRaw.forEach((p, i) => {
    if (!p || typeof p !== 'object') { errors.push(`phase[${i}] が不正です`); return }
    const phase = p as Record<string, unknown>
    const title = pickString(phase.title)
    if (!title) { errors.push(`phase[${i}].title が必要です`); return }
    if (phaseTitleSet.has(title)) warnings.push(`phase title が重複: ${title}`)
    phaseTitleSet.add(title)
    const id = pickString(phase.id)
    if (id) phaseIdSet.add(id)
  })

  todosRaw.forEach((t, i) => {
    if (!t || typeof t !== 'object') { errors.push(`todo[${i}] が不正です`); return }
    const todo = t as Record<string, unknown>
    const title = pickString(todo.title)
    if (!title) errors.push(`todo[${i}].title が必要です`)
    const role = pickRole(todo.role, 'claude')
    perRole[role] += 1
    const phaseId = pickString(todo.phaseId)
    const phaseTitle = pickString(todo.phaseTitle)
    if (!phaseId && !phaseTitle) {
      warnings.push(`todo[${i}] (${title}) に phaseId/phaseTitle がありません — 最初のフェーズに割り当てます`)
    } else if (phaseId && !phaseIdSet.has(phaseId) && !phaseTitleSet.has(phaseTitle)) {
      warnings.push(`todo[${i}] (${title}) の phaseId/phaseTitle が phases に見つかりません`)
    }
    const doneCriteria = pickStringArray(todo.doneCriteria)
    if (doneCriteria.length === 0) warnings.push(`todo[${i}] (${title}) に doneCriteria がありません`)
  })

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    phaseCount: phasesRaw.length,
    todoCount: todosRaw.length,
    perRole,
  }
}

function roleToAssignee(role: GoalRole): TaskAssignee {
  if (role === 'human') return 'user'
  if (role === 'codex') return 'claude'
  return 'claude'
}

function roleLabel(role: GoalRole): string {
  if (role === 'human') return '人間'
  if (role === 'codex') return 'Codex'
  return 'Claude'
}

export interface GoalImportResult {
  goalId: string
  phaseCount: number
  todoCount: number
  taskIds: string[]
  queuedCount: number
  queueSkippedCount: number
  errors: string[]
  warnings: string[]
}

export async function importGoal(rawInput: unknown, opts: { projects: { id: string; name: string }[] }): Promise<GoalImportResult> {
  const validation = validateGoalImport(rawInput, opts.projects)
  if (!validation.ok) {
    return {
      goalId: '',
      phaseCount: 0,
      todoCount: 0,
      taskIds: [],
      queuedCount: 0,
      queueSkippedCount: 0,
      errors: validation.errors,
      warnings: validation.warnings,
    }
  }

  const obj = rawInput as Record<string, unknown>
  const input: GoalImportInput = {
    projectId: pickString(obj.projectId),
    goalTitle: pickString(obj.goalTitle),
    goalSummary: pickString(obj.goalSummary),
    priority: pickPriority(obj.priority),
    monetizationImpact: pickImpact(obj.monetizationImpact),
    phases: (Array.isArray(obj.phases) ? obj.phases : []) as GoalImportInputPhase[],
    todos: (Array.isArray(obj.todos) ? obj.todos : []) as GoalImportInputTodo[],
    setAsMain: obj.setAsMain === true,
    addToQueueRoles: Array.isArray(obj.addToQueueRoles)
      ? (obj.addToQueueRoles as unknown[]).filter((r): r is GoalRole => VALID_ROLES.includes(r as GoalRole))
      : [],
  }

  const now = nowIso()
  const goalId = genId('goal')

  const phases: GoalPhase[] = input.phases.map((p, i) => {
    const rawPhase = p as unknown as Record<string, unknown>
    const id = pickString(rawPhase.id) || genId('phase')
    return {
      id,
      title: pickString(rawPhase.title),
      summary: pickString(rawPhase.summary),
      order: typeof rawPhase.order === 'number' ? rawPhase.order : i,
      status: rawPhase.status === 'in_progress' || rawPhase.status === 'done' ? rawPhase.status : 'todo',
    }
  })

  const titleToPhaseId = new Map<string, string>()
  const phaseIdSet = new Set<string>()
  phases.forEach((ph) => {
    titleToPhaseId.set(ph.title, ph.id)
    phaseIdSet.add(ph.id)
  })

  const todos: GoalTodo[] = input.todos.map((t, i) => {
    const rawTodo = t as unknown as Record<string, unknown>
    let phaseId = pickString(rawTodo.phaseId)
    const phaseTitle = pickString(rawTodo.phaseTitle)
    if (!phaseId || !phaseIdSet.has(phaseId)) {
      phaseId = (phaseTitle && titleToPhaseId.get(phaseTitle)) || phases[0]?.id || ''
    }
    return {
      id: pickString(rawTodo.id) || genId('gtodo'),
      goalId,
      phaseId,
      title: pickString(rawTodo.title),
      role: pickRole(rawTodo.role),
      order: typeof rawTodo.order === 'number' ? rawTodo.order : i,
      priority: pickPriority(rawTodo.priority),
      nextAction: pickString(rawTodo.nextAction),
      doneCriteria: pickStringArray(rawTodo.doneCriteria),
      taskPrompt: pickString(rawTodo.taskPrompt),
      memo: pickString(rawTodo.memo),
      status: 'pending',
      dependsOn: pickStringArray(rawTodo.dependsOn),
      createdAt: now,
      updatedAt: now,
    }
  })

  const projectName = opts.projects.find((p) => p.id === input.projectId)?.name ?? input.projectId

  const taskInputs: NewTaskInput[] = todos.map((todo) => {
    const phase = phases.find((p) => p.id === todo.phaseId)
    const roleTag = `[${roleLabel(todo.role)}]`
    const phaseTag = phase ? `[${phase.title}]` : ''
    const composedMemo = [
      roleTag,
      phaseTag,
      `goal:${input.goalTitle}`,
      todo.memo,
    ].filter(Boolean).join(' ')
    return {
      projectId: input.projectId,
      title: todo.title,
      status: 'pending_approval',
      priority: todo.priority,
      assignee: roleToAssignee(todo.role),
      memo: composedMemo,
      taskPrompt: todo.taskPrompt || undefined,
      doneCriteria: todo.doneCriteria.length > 0 ? todo.doneCriteria : undefined,
      targetApp: projectName,
    }
  })

  const taskIds = await addTasks(taskInputs)
  todos.forEach((todo, i) => { todo.taskId = taskIds[i] })

  const goal: Goal = {
    id: goalId,
    projectId: input.projectId,
    title: input.goalTitle,
    summary: input.goalSummary || '',
    status: 'active',
    priority: input.priority || 'medium',
    monetizationImpact: input.monetizationImpact || 'none',
    phases,
    todos,
    createdAt: now,
    updatedAt: now,
  }

  const data = await readGoals()
  data.goals.push(goal)
  if (input.setAsMain || !data.mainGoalId) {
    data.mainGoalId = goalId
  }
  await writeGoals(data)

  let queuedCount = 0
  let queueSkippedCount = 0
  if (Array.isArray(input.addToQueueRoles) && input.addToQueueRoles.length > 0) {
    const roleSet = new Set(input.addToQueueRoles)
    for (const todo of todos) {
      if (!todo.taskId) { queueSkippedCount += 1; continue }
      if (!roleSet.has(todo.role)) continue
      try {
        const result = await addTaskDirectlyToQueue(input.projectId, todo.taskId)
        if (result.added) queuedCount += 1
        else queueSkippedCount += 1
      } catch {
        queueSkippedCount += 1
      }
    }
  }

  return {
    goalId,
    phaseCount: phases.length,
    todoCount: todos.length,
    taskIds,
    queuedCount,
    queueSkippedCount,
    errors: [],
    warnings: validation.warnings,
  }
}

export async function setMainGoal(goalId: string): Promise<GoalsData> {
  const data = await readGoals()
  if (!data.goals.some((g) => g.id === goalId)) throw new Error(`Goal not found: ${goalId}`)
  data.mainGoalId = goalId
  await writeGoals(data)
  return data
}

export async function upsertGoal(input: GoalUpsertInput): Promise<Goal> {
  const title = pickString(input.title)
  if (!title) throw new Error('title is required')
  const data = await readGoals()
  const now = nowIso()
  const goalId = pickString(input.id) || genId('goal')
  const idx = data.goals.findIndex((g) => g.id === goalId)
  const previous = idx >= 0 ? data.goals[idx] : undefined
  const target = pickNumber(input.target, previous?.target ?? 100)
  const goal: Goal = {
    id: goalId,
    projectId: previous?.projectId,
    title,
    description: pickString(input.description, previous?.description ?? previous?.summary ?? ''),
    metric: pickString(input.metric, previous?.metric ?? 'progress'),
    target,
    current: pickNumber(input.current, previous?.current ?? 0),
    isNorthStar: input.isNorthStar === true,
    summary: pickString(input.description, previous?.summary ?? ''),
    status: pickGoalStatus(input.status, previous?.status ?? 'active'),
    priority: pickPriority(input.priority, previous?.priority ?? 'medium'),
    priorityBoost: previous?.priorityBoost,
    pinnedTop: previous?.pinnedTop,
    monetizationImpact: previous?.monetizationImpact ?? 'none',
    phases: previous?.phases ?? [],
    todos: previous?.todos ?? [],
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  }

  if (goal.isNorthStar) {
    data.goals = data.goals.map((g) => ({ ...g, isNorthStar: g.id === goalId }))
  }
  if (idx >= 0) data.goals[idx] = goal
  else data.goals.push(goal)
  if (input.setAsMain === true || !data.mainGoalId) data.mainGoalId = goalId
  await writeGoals(data)
  return goal
}

export async function syncGoalTodoStatuses(): Promise<{ synced: number }> {
  const data = await readGoals()
  if (data.goals.length === 0) return { synced: 0 }

  const tasksPath = path.join(getDataPath(), 'project-tasks.json')
  let tasksContent: string
  try {
    tasksContent = await fs.readFile(tasksPath, 'utf-8')
  } catch {
    return { synced: 0 }
  }
  const tasksData = JSON.parse(tasksContent) as {
    projects: Array<{ projectId: string; tasks: Array<{ id: string; status: string }> }>
  }

  const taskStatusMap = new Map<string, string>()
  for (const proj of tasksData.projects) {
    for (const t of proj.tasks) taskStatusMap.set(t.id, t.status)
  }

  let synced = 0
  for (const goal of data.goals) {
    for (const todo of goal.todos) {
      if (!todo.taskId) continue
      const status = taskStatusMap.get(todo.taskId)
      if (!status) continue
      const next: GoalTodo['status'] = status === 'done'
        ? 'done'
        : status === 'in_progress' || status === 'impl_done' || status === 'local_done'
        ? 'active'
        : status === 'skipped' || status === 'deleted'
        ? 'skipped'
        : 'pending'
      if (todo.status !== next) {
        todo.status = next
        todo.updatedAt = nowIso()
        synced += 1
      }
    }
  }

  if (synced > 0) await writeGoals(data)
  return { synced }
}
