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
  latestRunId?: string
  lastRunAt?: string
  updatedAt?: string
  queueScore: number
  queueOrder: number
  candidateEligible: boolean
  candidateBlockedReason?: string
  /** 候補外のとき、ユーザーが「どうすれば自動実行候補に入るか」の具体的な解消手順とボタン。 */
  resolution?: QueueResolution
  reason: string
  reasonFactors: string[]
  queueControl?: QueueControl
}

/** 候補外アイテムの解消方法。how=1行手順、actionLabel/actionHref=遷移ボタン（あれば）。 */
export interface QueueResolution {
  how: string
  actionLabel?: string
  actionHref?: string
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
  nextCandidateCount: number
  waitingUser: number
  aiHold: number
  reviewWaiting: number
  blocked: number
  manual: number
  lastRunAt?: string
  latestWorkTitle?: string
  nextActionTitle?: string
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
  pinnedExcluded: AutoQueueItem[]
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
  | 'include'
  | 'moveUp'
  | 'moveDown'
  | 'setManualOrder'
