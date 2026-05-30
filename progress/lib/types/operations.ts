export type DecisionPolicy = 'autonomous' | 'approval_required' | 'budget_sensitive' | 'destructive_sensitive'
export type ApprovalPriority = 'critical' | 'high' | 'normal' | 'low'
export type ApprovalCategory =
  | 'goal_change'
  | 'billing'
  | 'destructive'
  | 'production_risk'
  | 'secret'
  | 'external_publish'
  | 'monetization'
  | 'multi_option'
  | 'executor_fallback'

export type ExecutorType = 'claude' | 'codex' | 'manual' | 'other'

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
  flag?: 'billing' | 'destructive' | 'secret' | 'external_publish'
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

export interface ExecutorSummary {
  executor: ExecutorType
  runnable: number
  running: number
  completedRuns: number
  failedRuns: number
}

export interface NextTodoCandidate {
  sourceRunId: string
  targetApp: string
  title: string
  reviewStatus: string
  createdAt: string
}

export interface HandoffSummary {
  exists: boolean
  source: 'today-session' | 'none'
  status: string
  hasStructuredHandoff: boolean
  textLength: number
  updatedAt?: string
  requiredSections: string[]
  missingSections: string[]
}

export interface AutomationReadiness {
  vloopSourceOfTruth: string
  executionTarget: string
  approvalQueue: {
    pending: number
    critical: number
    high: number
    mobileSelectable: number
  }
  decisionLog: {
    entries: number
    latestDecisionAt?: string
  }
  aiGeneratedTodos: {
    fromExecutionRunNextActions: number
    persistedAsTasks: number
    candidates: NextTodoCandidate[]
  }
  executors: ExecutorSummary[]
  handoff: HandoffSummary
  restartReadiness: {
    canResumeFromQueue: boolean
    canResumeFromDecisionLog: boolean
    canFallbackToCodex: boolean
    blockers: string[]
  }
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
