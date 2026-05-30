export type DecisionPolicy = 'autonomous' | 'approval_required' | 'budget_sensitive' | 'destructive_sensitive'
export type ApprovalPriority = 'critical' | 'high' | 'low'
export type ApprovalCategory = 'goal_change' | 'billing' | 'destructive' | 'monetization' | 'multi_option'

export interface Epic {
  epicId: string
  githubIssue?: number
  title: string
  goal: string
  progress: number
  remainingWork: string[]
  latestRunId?: string | null
  nextAction: string
  decisionPolicy: DecisionPolicy
  autoApprovalRule?: string
  status: 'active' | 'paused' | 'blocked' | 'done'
  relatedTodoIds?: string[]
  updatedAt: string
}

export interface ApprovalOption {
  key: string
  label: string
  detail?: string
  flag?: 'billing' | 'destructive'
}

export interface Approval {
  approvalId: string
  epicId?: string
  title: string
  priority: ApprovalPriority
  category: ApprovalCategory
  options: ApprovalOption[]
  recommended: string
  reason: string
  status: 'pending' | 'decided' | 'expired'
  decidedOption?: string
  decidedBy?: string
  decidedAt?: string
  createdRunId?: string
  createdAt: string
}

export interface OperationalDecision {
  decisionId: string
  epicId?: string
  topic: string
  decision: string
  approvalId?: string
  decidedAt: string
}

export interface HealthSummary {
  runnable: number
  running: number
  pendingApproval: number
  limitWaiting: number
  stopped: number
  epicsActive: number
  stale: number
}
