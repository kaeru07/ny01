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
  /** 任意。この Epic に属する ExecutionRun を targetApp でフォールバック結合するためのキー群（例: ["progress","ny01/progress"]）。 */
  targetApps?: string[]
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

export interface PendingTodoGenerationResult {
  created: number
  skipped: number
  taskIds: string[]
  candidates: NextTodoCandidate[]
}

export interface DecisionContext {
  decisions: OperationalDecision[]
  promptBlock: string
  readTiming: string[]
  injectionTargets: string[]
}

export interface GeneratedHandoff {
  source: 'generated'
  objective: string
  currentState: string
  changedFiles: string[]
  remainingWork: string[]
  forbidden: string[]
  checks: string[]
  decisionLog: string[]
  approvalsPending: string[]
  nextActions: NextTodoCandidate[]
  promptBlock: string
  generatedAt: string
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
  generatedHandoff: {
    available: boolean
    source: string
    nextActions: number
    pendingApprovals: number
  }
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

/** Epic 詳細画面（AI工場の主画面）が必要とするデータを既存正本から集約したビュー。新しい正本ではない。 */
export interface EpicDetail {
  epic: Epic
  /** この Epic にひもづく ExecutionRun を絞り込めたか。'epic' = 正確に結合 / 'global-fallback' = 結合キー未整備のため全体の直近を仮表示。 */
  runScope: 'epic' | 'global-fallback'
  /** 前回作業（最新 ExecutionRun） */
  latestRun: ExecutionRunBrief | null
  /** 実行履歴（直近数件） */
  recentRuns: ExecutionRunBrief[]
  /** 決定事項（最新数件 / 全件は /decisions） */
  recentDecisions: OperationalDecision[]
  /** 次回予定（Next Actions） */
  nextActions: NextTodoCandidate[]
  /** この Epic の承認待ち（横断は /approvals） */
  pendingApprovals: Approval[]
  /** Automation 状態（最低限: executor / running / stopped / 承認待ち件数） */
  automation: {
    executors: ExecutorSummary[]
    running: number
    stopped: number
    pendingApproval: number
  }
}

/** Epic 詳細・実行履歴カードで使う ExecutionRun の軽量表現。 */
export interface ExecutionRunBrief {
  runId: string
  finishedAt: string
  targetApp: string
  targetTodoTitle: string
  runStatus: string
  reviewStatus: string
  summary: string
  executor: ExecutorType
  changedFilesCount: number
  nextActions: string[]
}
