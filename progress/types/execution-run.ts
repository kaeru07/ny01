export type RunStatus = 'running' | 'completed' | 'failed' | 'partial'
export type ReviewStatus = 'not_reviewed' | 'copied' | 'reviewed' | 'needs_followup'

export interface ChangedFile {
  file: string
  change: string
}

export interface CheckResult {
  build?: string
  typescript?: string
  lint?: string
  mainScreen?: string
  mobileLayout?: string
  // backward compat — old field names
  mainScreens?: string
  iphone?: string
  [key: string]: string | undefined
}

export interface ExecutionRun {
  runId: string
  startedAt: string
  finishedAt: string
  targetApp: string
  targetTodoId?: string
  targetTodoTitle: string
  runStatus: RunStatus
  reviewStatus: ReviewStatus
  beforeStatus?: string
  afterStatus?: string
  promptUsed?: string
  summary: string
  changedFiles: ChangedFile[]
  checks: CheckResult
  errors: string[]
  warnings: string[]
  progressUpdated: boolean
  nextActions: string[]
  rawReport: string
}

export interface ExecutionRunsData {
  runs: ExecutionRun[]
}
