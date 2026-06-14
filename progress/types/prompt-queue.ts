export type PromptQueueStatus =
  | 'queued'
  | 'reserved'
  | 'not_started'
  | 'running'
  | 'completed'
  | 'failed'
  | 'needs_retry'
  | 'needs_user_prompt_fix'
  | 'needs_review'
  | 'canceled'
  | 'snoozed'
  | 'archived'

export type PromptQueueSource =
  | 'manual'
  | 'json_import'
  | 'project'
  | 'goal_progress'
  | 'inbox'
  | 'review'

export interface PromptQueueItem {
  id: string
  title: string
  prompt: string
  projectId?: string
  projectName?: string
  goalProgressId?: string
  goalProgressTitle?: string
  status: PromptQueueStatus
  source: PromptQueueSource
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  executionRunId?: string
  resultSummary?: string
  errorMessage?: string
  notes?: string
  relatedInboxId?: string
  relatedReviewId?: string
  relatedUrl?: string
  /** 内部互換用。UIには出さない。 */
  priority?: string
  /** 内部互換用。UIには出さない。 */
  preferredExecutor?: 'auto'
  /** 内部互換用。UIには出さず、Goal進捗へ寄せる。 */
  goalId?: string
  /** 内部互換用。UIには出さず、Goal進捗へ寄せる。 */
  goalTitle?: string
}

export interface PromptQueueCandidate extends PromptQueueItem {
  candidateOrder: number
  candidateReason: string
}

export interface PromptQueueView {
  updatedAt: string
  items: PromptQueueItem[]
  nextCandidates: PromptQueueCandidate[]
  counts: Record<PromptQueueStatus, number>
}

export interface PromptQueueInput {
  title?: string
  prompt?: string
  projectId?: string
  projectName?: string
  goalProgressId?: string
  goalProgressTitle?: string
  status?: PromptQueueStatus
  source?: PromptQueueSource
  notes?: string
  relatedInboxId?: string
  relatedReviewId?: string
  relatedUrl?: string
  executionRunId?: string
  resultSummary?: string
  errorMessage?: string
}

export interface PromptQueueImportResult {
  imported: number
  warnings: string[]
  errors: string[]
  items: PromptQueueItem[]
}
