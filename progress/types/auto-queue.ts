import type { DecisionPolicy, ExecutorType, EpicPriority } from '@/lib/types/operations'

export type WorkItemStatus =
  | 'executable'
  | 'waiting_user'
  | 'ai_hold'
  | 'review_waiting'
  | 'blocked'
  | 'manual'
  | 'done'

export interface QueueControl {
  pinnedTop?: boolean
  pinnedAt?: string
  manualOrder?: number
  hold?: boolean
  excludedByUser?: boolean
  updatedBy?: 'user' | 'system'
  updatedAt?: string
}

export interface AutoQueueItem {
  workItemId: string
  type: 'epic' | 'goal_todo'
  sourceId: string
  title: string
  goalId?: string
  goalTitle?: string
  projectId?: string
  projectName?: string
  status: WorkItemStatus
  priority: EpicPriority
  factoryEligible: boolean
  decisionPolicy: DecisionPolicy
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  doneCriteriaTotal: number
  doneCriteriaDone: number
  blockers: string[]
  lastRunAt?: string
  updatedAt?: string
  queueScore: number
  queueOrder: number
  reason: string
  reasonFactors: string[]
  queueControl?: QueueControl
}

export interface AutoQueueCounts extends Record<WorkItemStatus, number> {
  inbox: number
}

export interface GoalProgressRow {
  goalId: string
  title: string
  projectId?: string
  total: number
  done: number
  ratio: number
  executable: number
  waitingUser: number
  aiHold: number
  reviewWaiting: number
  blocked: number
  lastRunAt?: string
  priorityBoost?: 0 | 1 | 2
  pinnedTop?: boolean
}

export interface AutoQueueView {
  next: AutoQueueItem | null
  candidates: AutoQueueItem[]
  executable: AutoQueueItem[]
  waitingUser: AutoQueueItem[]
  aiHold: AutoQueueItem[]
  reviewWaiting: AutoQueueItem[]
  blocked: AutoQueueItem[]
  manual: AutoQueueItem[]
  counts: AutoQueueCounts
  goalProgress: GoalProgressRow[]
  generatedAt: string
}

export type AutoQueueControlAction =
  | 'pin'
  | 'unpin'
  | 'hold'
  | 'unhold'
  | 'exclude'
  | 'moveUp'
  | 'moveDown'
  | 'setManualOrder'
