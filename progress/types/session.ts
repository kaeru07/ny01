import type { ExecutorType, TaskPriority } from '@/types/progress'

export type { TaskPriority }

export type WorkCandidateStatus = 'pending_decision' | 'approved' | 'rejected' | 'held'

export type WorkItemStatus = 'queued' | 'in_progress' | 'done' | 'blocked' | 'skipped'

export type WorkEffort = 'small' | 'medium' | 'large'

export type SessionStatus = 'pending' | 'in_progress' | 'done' | 'handoff'

export interface WorkCandidate {
  id: string
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  description: string
  priority: TaskPriority
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  autoFallback?: boolean
  canRunOnCodex?: boolean
  requiresClaude?: boolean
  estimatedEffort: WorkEffort
  reason: string
  prerequisites: string
  risks: string
  doneCondition: string
  status: WorkCandidateStatus
  userMemo: string
  autoScore: number
  createdAt: string
  updatedAt: string
}

export interface WorkCandidatesData {
  candidates: WorkCandidate[]
  lastRefreshed: string
}

export interface WorkQueueItem {
  id: string
  candidateId: string
  projectId: string
  projectName: string
  taskId: string
  taskTitle: string
  description: string
  priority: TaskPriority
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  autoFallback?: boolean
  canRunOnCodex?: boolean
  requiresClaude?: boolean
  executorUsed?: ExecutorType
  fallbackReason?: string
  status: WorkItemStatus
  autoOrder: number
  manualOrder?: number
  orderUpdatedBy?: 'system' | 'user'
  orderUpdatedAt?: string
  orderMemo?: string
  reason: string
  doneCondition: string
  userMemo: string
  workLog: string
  taskPrompt?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface WorkQueueData {
  items: WorkQueueItem[]
  lastGenerated: string
}

export interface WorkSession {
  date: string
  status: SessionStatus
  handoffText: string
  handoff?: HandoffState
  startedAt?: string
  endedAt?: string
  createdAt: string
  updatedAt: string
}

export interface HandoffState {
  objective: string
  currentState: string
  changedFiles: string[]
  remainingWork: string[]
  forbidden: string[]
  checks: string[]
  decisionLog: string[]
  approvalsPending: string[]
  codexPrompt?: string
  updatedAt: string
}
