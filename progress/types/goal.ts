import type { TaskPriority } from '@/types/progress'

export type GoalRole = 'human' | 'claude' | 'codex'

export type GoalStatus = 'active' | 'paused' | 'done' | 'dropped' | 'archived'

export type GoalPhaseStatus = 'todo' | 'in_progress' | 'done'

export type GoalTodoStatus = 'pending' | 'active' | 'done' | 'skipped'

export type MonetizationImpact = 'high' | 'medium' | 'low' | 'none'

export interface GoalPhase {
  id: string
  title: string
  summary: string
  order: number
  status: GoalPhaseStatus
}

export interface GoalTodo {
  id: string
  goalId: string
  phaseId: string
  taskId?: string
  title: string
  role: GoalRole
  order: number
  priority: TaskPriority
  nextAction: string
  doneCriteria: string[]
  taskPrompt: string
  memo: string
  status: GoalTodoStatus
  dependsOn: string[]
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  projectId?: string
  title: string
  description?: string
  metric?: string
  target?: number
  current?: number
  isNorthStar?: boolean
  summary: string
  status: GoalStatus
  priority: TaskPriority
  monetizationImpact: MonetizationImpact
  phases: GoalPhase[]
  todos: GoalTodo[]
  createdAt: string
  updatedAt: string
}

export interface GoalsData {
  goals: Goal[]
  mainGoalId?: string
  updatedAt: string
}

export interface GoalUpsertInput {
  id?: string
  title: string
  description?: string
  metric?: string
  target?: number
  current?: number
  priority?: TaskPriority
  status?: GoalStatus
  isNorthStar?: boolean
  setAsMain?: boolean
}

export interface GoalImportInputPhase {
  id?: string
  title: string
  summary?: string
  order?: number
  status?: GoalPhaseStatus
}

export interface GoalImportInputTodo {
  id?: string
  phaseId?: string
  phaseTitle?: string
  title: string
  role?: GoalRole
  order?: number
  priority?: TaskPriority
  nextAction?: string
  doneCriteria?: string[]
  taskPrompt?: string
  memo?: string
  dependsOn?: string[]
}

export interface GoalImportInput {
  projectId: string
  goalTitle: string
  goalSummary?: string
  priority?: TaskPriority
  monetizationImpact?: MonetizationImpact
  phases: GoalImportInputPhase[]
  todos: GoalImportInputTodo[]
  setAsMain?: boolean
  addToQueueRoles?: GoalRole[]
}

export interface GoalRoleCounts {
  human: number
  claude: number
  codex: number
}

export interface GoalProgress {
  totalTodos: number
  doneTodos: number
  ratio: number
  perRole: GoalRoleCounts
  openPerRole: GoalRoleCounts
}
