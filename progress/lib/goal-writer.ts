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
  GoalTodoStatus,
  GoalsData,
  GoalStatus,
  GoalUpsertInput,
  MonetizationImpact,
} from '@/types/goal'
import type { NewTaskInput, TaskAssignee, TaskPriority } from '@/types/progress'
import type { DecisionPolicy, EpicRiskFlag } from '@/lib/types/operations'
import type { QueueControl } from '@/types/auto-queue'

const VALID_ROLES: GoalRole[] = ['human', 'claude', 'codex']
const VALID_PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const VALID_IMPACT: MonetizationImpact[] = ['high', 'medium', 'low', 'none']
const VALID_GOAL_STATUS: GoalStatus[] = ['proposed', 'active', 'paused', 'done', 'dropped', 'archived']
const VALID_TODO_STATUS: GoalTodoStatus[] = ['pending', 'active', 'done', 'skipped']
const VALID_DECISION_POLICIES: DecisionPolicy[] = ['autonomous', 'approval_required', 'manual', 'budget_sensitive', 'destructive_sensitive']
const VALID_RISK_FLAGS: EpicRiskFlag[] = ['billing', 'production_db', 'auth_secret', 'deploy', 'migration', 'destructive', 'external_publish']

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

function pickRiskFlags(value: unknown): EpicRiskFlag[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is EpicRiskFlag => VALID_RISK_FLAGS.includes(v as EpicRiskFlag))
}

function pickDecisionPolicy(value: unknown, fallback: DecisionPolicy = 'autonomous'): DecisionPolicy {
  return VALID_DECISION_POLICIES.includes(value as DecisionPolicy) ? (value as DecisionPolicy) : fallback
}

function pickTodoStatus(value: unknown, fallback: GoalTodoStatus = 'pending'): GoalTodoStatus {
  return VALID_TODO_STATUS.includes(value as GoalTodoStatus) ? (value as GoalTodoStatus) : fallback
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

  // projectId は任意（未設定可）。指定された場合のみ存在チェック。
  if (projectId && !projects.some((p) => p.id === projectId)) {
    warnings.push(`projectId "${projectId}" が既存案件に見つかりません（未設定として取り込みます）`)
  }
  if (!goalTitle) errors.push('goalTitle は必須です')

  const phasesRaw = Array.isArray(obj.phases) ? obj.phases : []
  const todosRaw = Array.isArray(obj.todos) ? obj.todos : []

  // phases は任意（無ければ取り込み時に既定フェーズを自動生成）。todos も任意（ゴールだけの追加も可）。
  if (phasesRaw.length === 0 && todosRaw.length > 0) warnings.push('phases 未指定: 既定フェーズを自動生成して todos を紐づけます')

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

  // phases 未指定でも todos があれば既定フェーズを1つ用意して紐づける（ChatGPT出力の揺れに耐える）。
  if (input.phases.length === 0 && input.todos.length > 0) {
    input.phases = [{ id: 'phase-1', title: '初期フェーズ', summary: input.goalTitle, order: 0, status: 'todo' } as GoalImportInputPhase]
  }

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
      dueHint: pickString(rawTodo.dueHint) || undefined,
      decisionPolicy: rawTodo.decisionPolicy ? pickDecisionPolicy(rawTodo.decisionPolicy) : undefined,
      riskFlags: pickRiskFlags(rawTodo.riskFlags),
      source: rawTodo.source === 'manual_todo' || rawTodo.source === 'goal_resume' || rawTodo.source === 'review_fix' || rawTodo.source === 'ai_generated' ? rawTodo.source : 'ai_generated',
      status: pickTodoStatus(rawTodo.status, 'pending'),
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
      goalId,
      phaseId: todo.phaseId,
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
  const status = pickGoalStatus(input.status, previous?.status ?? 'active')
  const goal: Goal = {
    id: goalId,
    projectId: pickString(input.projectId, previous?.projectId ?? '') || undefined,
    title,
    description: pickString(input.description ?? input.summary, previous?.description ?? previous?.summary ?? ''),
    metric: pickString(input.metric, previous?.metric ?? 'progress'),
    target,
    current: pickNumber(input.current, previous?.current ?? 0),
    metricSyncedAt: previous?.metricSyncedAt,
    isNorthStar: input.isNorthStar === true,
    summary: pickString(input.summary ?? input.description, previous?.summary ?? ''),
    status,
    priority: pickPriority(input.priority, previous?.priority ?? 'medium'),
    priorityBoost: previous?.priorityBoost,
    pinnedTop: previous?.pinnedTop,
    queueControl: previous?.queueControl,
    decisionPolicyDefault: input.decisionPolicyDefault ? pickDecisionPolicy(input.decisionPolicyDefault, previous?.decisionPolicyDefault ?? 'autonomous') : previous?.decisionPolicyDefault,
    riskFlagsDefault: input.riskFlagsDefault ? pickRiskFlags(input.riskFlagsDefault) : previous?.riskFlagsDefault,
    notes: input.notes !== undefined ? pickString(input.notes, previous?.notes ?? '') || undefined : previous?.notes,
    proposalSource: previous?.proposalSource,
    proposedAt: status === 'proposed' ? (previous?.proposedAt ?? now) : previous?.proposedAt,
    approvedAt: previous?.approvedAt,
    proposalEnables: previous?.proposalEnables,
    proposalPros: previous?.proposalPros,
    proposalCons: previous?.proposalCons,
    monetizationImpact: pickImpact(input.monetizationImpact, previous?.monetizationImpact ?? 'none'),
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

// --- 自動実行中のゴール提案 → 承認 → 自動実行 ---

export interface ProposeGoalInput {
  title: string
  summary?: string
  projectId?: string
  metric?: string
  target?: number
  current?: number
  priority?: TaskPriority | 'P0' | 'P1' | 'P2'
  /** 提案の根拠（どのデータ/状況から提案したか）。承認判断のため Inbox に表示する。 */
  rationale?: string
  /** 提案元（例: factory_idle / claude / codex / manual / research）。 */
  source?: string
  /** 承認カード用: このゴールでできるようになること。 */
  enables?: string
  /** 承認カード用: メリット。 */
  pros?: string[]
  /** 承認カード用: デメリット・注意。 */
  cons?: string[]
}

export interface ProposeGoalsResult {
  created: Goal[]
  skipped: Array<{ title: string; reason: string }>
}

/**
 * AIが提案したゴール候補を status='proposed' で登録する（承認されるまで自動実行対象にしない）。
 * 既に同名の active / proposed ゴールがある候補は重複としてスキップする。
 */
export async function proposeGoals(inputs: ProposeGoalInput[], opts: { source?: string } = {}): Promise<ProposeGoalsResult> {
  const data = await readGoals()
  const now = nowIso()
  const created: Goal[] = []
  const skipped: Array<{ title: string; reason: string }> = []
  const existingTitles = new Set(
    data.goals.filter((g) => g.status === 'active' || g.status === 'proposed').map((g) => g.title.trim()),
  )
  for (const input of inputs) {
    const title = pickString(input.title)
    if (!title) {
      skipped.push({ title: '(無題)', reason: 'titleが空' })
      continue
    }
    if (existingTitles.has(title)) {
      skipped.push({ title, reason: '同名のactive/proposedゴールが既存' })
      continue
    }
    existingTitles.add(title)
    const target = pickNumber(input.target, 100)
    const goal: Goal = {
      id: genId('goal'),
      projectId: pickString(input.projectId) || undefined,
      title,
      description: pickString(input.summary),
      summary: pickString(input.summary),
      metric: pickString(input.metric, 'progress'),
      target,
      current: pickNumber(input.current, 0),
      isNorthStar: false,
      status: 'proposed',
      priority: mapPriority(input.priority),
      // 承認後すぐ自動実行対象になるよう autonomous を既定にする（承認＝実行許可）。
      decisionPolicyDefault: 'autonomous',
      riskFlagsDefault: [],
      notes: input.rationale ? `提案根拠: ${input.rationale}` : undefined,
      monetizationImpact: 'none',
      phases: [],
      todos: [],
      proposalSource: opts.source ?? input.source ?? 'ai',
      proposedAt: now,
      proposalEnables: pickString(input.enables) || undefined,
      proposalPros: Array.isArray(input.pros) ? input.pros.filter((p) => typeof p === 'string' && p.trim()) : undefined,
      proposalCons: Array.isArray(input.cons) ? input.cons.filter((c) => typeof c === 'string' && c.trim()) : undefined,
      createdAt: now,
      updatedAt: now,
    }
    data.goals.push(goal)
    created.push(goal)
  }
  if (created.length > 0) await writeGoals(data)
  return { created, skipped }
}

/** 提案ゴールを承認(→active=自動実行対象)または却下(→dropped)する。 */
export async function setGoalApproval(goalId: string, approve: boolean): Promise<Goal | null> {
  const data = await readGoals()
  const idx = data.goals.findIndex((g) => g.id === goalId)
  if (idx < 0) return null
  const now = nowIso()
  const goal = data.goals[idx]
  data.goals[idx] = {
    ...goal,
    status: approve ? 'active' : 'dropped',
    approvedAt: approve ? now : goal.approvedAt,
    updatedAt: now,
  }
  await writeGoals(data)
  return data.goals[idx]
}

export interface SingleGoalInput {
  title: string
  projectId?: string
  prompt?: string
  priority?: TaskPriority | 'P0' | 'P1' | 'P2'
  status?: GoalStatus | 'backlog'
  decisionPolicy?: DecisionPolicy
  riskFlags?: EpicRiskFlag[]
  notes?: string
  setAsMain?: boolean
  // 進捗の正本「今/目標」(current/target)を手動設定できるようにする（progress=current/target）。
  metric?: string
  target?: number
  current?: number
}

function mapPriority(value: unknown, fallback: TaskPriority = 'medium'): TaskPriority {
  if (value === 'P0') return 'high'
  if (value === 'P1') return 'medium'
  if (value === 'P2') return 'low'
  return pickPriority(value, fallback)
}

function mapGoalStatus(value: unknown): GoalStatus {
  if (value === 'backlog') return 'paused'
  return pickGoalStatus(value, 'active')
}

export async function upsertSingleGoal(input: SingleGoalInput): Promise<Goal> {
  const title = pickString(input.title)
  if (!title) throw new Error('title is required')
  const now = nowIso()
  const data = await readGoals()
  const goalId = genId('goal')
  const phaseId = genId('phase')
  const priority = mapPriority(input.priority)
  const riskFlags = pickRiskFlags(input.riskFlags)
  const decisionPolicy = pickDecisionPolicy(input.decisionPolicy)
  const todoId = genId('gtodo')
  const prompt = pickString(input.prompt)
  const notes = pickString(input.notes)

  const goal: Goal = {
    id: goalId,
    projectId: pickString(input.projectId) || undefined,
    title,
    summary: prompt || notes || '',
    description: prompt || notes || '',
    metric: pickString(input.metric, 'progress'),
    target: pickNumber(input.target, 100),
    current: pickNumber(input.current, 0),
    status: mapGoalStatus(input.status),
    priority,
    decisionPolicyDefault: decisionPolicy,
    riskFlagsDefault: riskFlags,
    notes: notes || undefined,
    monetizationImpact: 'none',
    phases: [{
      id: phaseId,
      title: '初期フェーズ',
      summary: prompt || title,
      order: 0,
      status: 'todo',
    }],
    todos: [{
      id: todoId,
      goalId,
      phaseId,
      title,
      role: 'claude',
      order: 0,
      priority,
      nextAction: prompt || title,
      doneCriteria: [],
      taskPrompt: prompt,
      memo: notes,
      decisionPolicy,
      riskFlags,
      source: 'manual_todo',
      status: 'pending',
      dependsOn: [],
      createdAt: now,
      updatedAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  }

  data.goals.push(goal)
  if (input.setAsMain === true || !data.mainGoalId) data.mainGoalId = goalId
  await writeGoals(data)
  return goal
}

export interface AppendGoalTodoInput {
  id?: string
  phaseId?: string
  title: string
  role?: GoalRole
  order?: number
  priority?: TaskPriority | 'P0' | 'P1' | 'P2'
  nextAction?: string
  doneCriteria?: string[]
  taskPrompt?: string
  memo?: string
  status?: GoalTodoStatus
  dependsOn?: string[]
  dueHint?: string
  decisionPolicy?: DecisionPolicy
  riskFlags?: EpicRiskFlag[]
  source?: GoalTodo['source']
}

export async function appendGoalTodos(goalId: string, rawTodos: AppendGoalTodoInput[]): Promise<{ goal: Goal; todos: GoalTodo[] }> {
  const data = await readGoals()
  const goal = data.goals.find((g) => g.id === goalId)
  if (!goal) throw new Error(`Goal not found: ${goalId}`)
  if (rawTodos.length === 0) throw new Error('todos are required')

  const now = nowIso()
  const phaseIds = new Set(goal.phases.map((phase) => phase.id))
  const defaultPhaseId = goal.phases[0]?.id || genId('phase')
  if (goal.phases.length === 0) {
    goal.phases.push({ id: defaultPhaseId, title: '未分類フェーズ', summary: '', order: 0, status: 'todo' })
  }
  const startOrder = goal.todos.length
  const todos: GoalTodo[] = rawTodos.map((todo, index) => {
    const phaseId = pickString(todo.phaseId)
    const source = todo.source === 'goal_resume' || todo.source === 'review_fix' || todo.source === 'ai_generated' ? todo.source : 'manual_todo'
    return {
      id: pickString(todo.id) || genId('gtodo'),
      goalId,
      phaseId: phaseId && phaseIds.has(phaseId) ? phaseId : defaultPhaseId,
      title: pickString(todo.title),
      role: pickRole(todo.role),
      order: typeof todo.order === 'number' ? todo.order : startOrder + index,
      priority: mapPriority(todo.priority),
      nextAction: pickString(todo.nextAction),
      doneCriteria: pickStringArray(todo.doneCriteria),
      taskPrompt: pickString(todo.taskPrompt),
      memo: pickString(todo.memo),
      status: pickTodoStatus(todo.status),
      dependsOn: pickStringArray(todo.dependsOn),
      dueHint: pickString(todo.dueHint) || undefined,
      decisionPolicy: todo.decisionPolicy ? pickDecisionPolicy(todo.decisionPolicy) : goal.decisionPolicyDefault,
      riskFlags: pickRiskFlags(todo.riskFlags).length > 0 ? pickRiskFlags(todo.riskFlags) : goal.riskFlagsDefault,
      source,
      createdAt: now,
      updatedAt: now,
    }
  })

  const invalid = todos.find((todo) => !todo.title)
  if (invalid) throw new Error('todo.title is required')
  goal.todos.push(...todos)
  goal.updatedAt = now
  await writeGoals(data)
  return { goal, todos }
}

export async function updateGoalTodo(goalId: string, todoId: string, updates: { status?: GoalTodoStatus; priority?: TaskPriority; queueControl?: QueueControl }): Promise<GoalTodo> {
  const data = await readGoals()
  const goal = data.goals.find((g) => g.id === goalId)
  if (!goal) throw new Error(`Goal not found: ${goalId}`)
  const todo = goal.todos.find((t) => t.id === todoId)
  if (!todo) throw new Error(`GoalTodo not found: ${todoId}`)
  const now = nowIso()
  if (updates.status !== undefined) todo.status = pickTodoStatus(updates.status, todo.status)
  if (updates.priority !== undefined) todo.priority = pickPriority(updates.priority, todo.priority)
  if (updates.queueControl !== undefined) todo.queueControl = { ...todo.queueControl, ...updates.queueControl, updatedBy: 'user', updatedAt: now }
  todo.updatedAt = now
  goal.updatedAt = now
  await writeGoals(data)
  return todo
}

export async function updateGoalControl(
  goalId: string,
  updates: {
    pinnedTop?: boolean
    priorityBoost?: 0 | 1 | 2
    queueControl?: Partial<QueueControl>
  },
): Promise<Goal | null> {
  const data = await readGoals()
  const goal = data.goals.find((g) => g.id === goalId)
  if (!goal) return null
  const now = nowIso()
  if (updates.pinnedTop !== undefined) goal.pinnedTop = updates.pinnedTop
  if (updates.priorityBoost !== undefined) goal.priorityBoost = updates.priorityBoost
  if (updates.queueControl !== undefined) {
    goal.queueControl = { ...goal.queueControl, ...updates.queueControl, updatedBy: 'user', updatedAt: now }
  }
  goal.updatedAt = now
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

/**
 * ゴールをプロジェクトに紐づける。assignments で明示指定、または defaultProjectId で
 * 未紐付け(projectId 無し)のゴールに一括設定する。「ゴールは必ずプロジェクトに紐づく」運用のための writer。
 */
export async function linkGoalProject(opts: {
  assignments?: Array<{ goalId: string; projectId: string }>
  defaultProjectId?: string
  onlyStatuses?: GoalStatus[]
}): Promise<{ linked: number; details: Array<{ goalId: string; title: string; projectId: string }> }> {
  const data = await readGoals()
  const now = nowIso()
  const byId = new Map(data.goals.map((g) => [g.id, g]))
  const details: Array<{ goalId: string; title: string; projectId: string }> = []
  let linked = 0

  for (const a of opts.assignments ?? []) {
    const g = byId.get(pickString(a.goalId))
    const pid = pickString(a.projectId)
    if (!g || !pid) continue
    if (g.projectId !== pid) { g.projectId = pid; g.updatedAt = now; linked += 1 }
    details.push({ goalId: g.id, title: g.title, projectId: pid })
  }

  if (opts.defaultProjectId) {
    const pid = pickString(opts.defaultProjectId)
    const statuses = opts.onlyStatuses
    for (const g of data.goals) {
      if (g.projectId && String(g.projectId).trim()) continue
      if (statuses && !statuses.includes(g.status)) continue
      g.projectId = pid
      g.updatedAt = now
      linked += 1
      details.push({ goalId: g.id, title: g.title, projectId: pid })
    }
  }

  if (linked > 0) await writeGoals(data)
  return { linked, details }
}
