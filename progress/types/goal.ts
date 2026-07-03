import type { TaskPriority } from '@/types/progress'
import type { DecisionPolicy, EpicRiskFlag } from '@/lib/types/operations'
import type { QueueControl } from '@/types/auto-queue'

export type GoalRole = 'human' | 'claude' | 'codex'

// 'proposed' = 自動実行中にAIが提案したゴール候補。承認(→active)されるまで自動実行対象にならない。
export type GoalStatus = 'proposed' | 'active' | 'paused' | 'done' | 'dropped' | 'archived'

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
  dueHint?: string
  decisionPolicy?: DecisionPolicy
  riskFlags?: EpicRiskFlag[]
  source?: 'manual_todo' | 'goal_resume' | 'review_fix' | 'ai_generated'
  queueControl?: QueueControl
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
  /** 達成方向。'up'=大きいほど良い(既定)。'down'=小さいほど良い(例: daily_decision_minutes は target に近づけたい)。 */
  metricDirection?: 'up' | 'down'
  target?: number
  current?: number
  /** computeFactoryMetrics 由来の自動計測値で current を更新した時刻（手動編集と区別する）。 */
  metricSyncedAt?: string
  isNorthStar?: boolean
  summary: string
  decisionPolicyDefault?: DecisionPolicy
  riskFlagsDefault?: EpicRiskFlag[]
  notes?: string
  status: GoalStatus
  priority: TaskPriority
  priorityBoost?: 0 | 1 | 2
  pinnedTop?: boolean
  queueControl?: QueueControl
  lastSelectedRunId?: string
  lastSelectedAt?: string
  /** 実メール送信が成功した時刻（不可逆・二重送信防止）。no-op(モック)では立てない。 */
  autonomyNotifiedAt?: string
  /** no-op(モック)通知をログした時刻（実送信フラグを消費せず、毎定時のログ重複を防ぐ）。 */
  autonomyNotifyNoopAt?: string
  autonomyNotifyAttempts?: number
  monetizationImpact: MonetizationImpact
  /** status='proposed' のときの提案元（factory_idle / claude / codex / manual / research など）。 */
  proposalSource?: string
  /** ゴール候補として提案された時刻。 */
  proposedAt?: string
  /** 提案ゴールが承認された時刻（承認＝自動実行対象化）。 */
  approvedAt?: string
  /** 承認カード用: このゴールでできるようになること（1〜数行）。 */
  proposalEnables?: string
  /** 承認カード用: メリット。 */
  proposalPros?: string[]
  /** 承認カード用: デメリット・注意。 */
  proposalCons?: string[]
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
  projectId?: string
  title: string
  description?: string
  summary?: string
  metric?: string
  target?: number
  current?: number
  priority?: TaskPriority
  status?: GoalStatus
  decisionPolicyDefault?: DecisionPolicy
  riskFlagsDefault?: EpicRiskFlag[]
  notes?: string
  monetizationImpact?: MonetizationImpact
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
  dueHint?: string
  decisionPolicy?: DecisionPolicy
  riskFlags?: EpicRiskFlag[]
  source?: 'manual_todo' | 'goal_resume' | 'review_fix' | 'ai_generated'
  dependsOn?: string[]
  status?: GoalTodoStatus
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
