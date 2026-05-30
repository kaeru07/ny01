export type ProjectStatus =
  | 'in_progress'
  | 'active'
  | 'done'
  | 'blocked'
  | 'archived'
  | 'user_action_pending'
  | 'deploy_ready'

// pending_approval: ユーザー承認待ち（Claude Code は絶対に着手しない）
// backlog: 未着手ストック / impl_done: build 成功・ローカル未確認 / local_done: ローカル確認済み・本番未確認
export type TaskStatus = 'pending_approval' | 'backlog' | 'todo' | 'in_progress' | 'impl_done' | 'local_done' | 'done' | 'blocked' | 'deleted' | 'skipped'

export type TaskPriority = 'high' | 'medium' | 'low'

export type ExecutorType = 'claude' | 'codex' | 'manual' | 'other'

// claude: Claude が実行できる / user: ユーザー操作が必要 / both: 両者が関与
export type TaskAssignee = 'claude' | 'user' | 'both'

export type WorkLogType =
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_added'
  | 'task_status_updated'
  | 'project_summary_updated'
  | 'blockers_updated'
  | 'project_added'
  | 'blocker_resolved'
  | 'blocker'
  | 'summary'

export interface Project {
  id: string
  name: string
  status: ProjectStatus
  phase: string
  progress: number
  currentTask: string
  nextAction: string
  blockers: string[]
  url?: string
  excluded?: boolean
  updatedAt: string
}

export interface AppProgress {
  projects: Project[]
}

export interface Task {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: TaskAssignee
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  autoFallback?: boolean
  canRunOnCodex?: boolean
  requiresClaude?: boolean
  executorUsed?: ExecutorType
  fallbackReason?: string
  memo: string
  source?: string
  sourceRunId?: string
  sourceType?: 'user' | 'ai_generated' | 'execution_review' | 'market_research' | 'vault' | 'github_issue'
  taskPrompt?: string
  taskPromptUpdatedAt?: string
  taskPromptUpdatedBy?: 'user' | 'system'
  doneCriteria?: string[]
  allowed?: string[]
  forbidden?: string[]
  risk?: string
  blockedReason?: string
  unblockAction?: string
  nextQuestion?: string
  targetPath?: string
  targetApp?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectTasks {
  projectId: string
  tasks: Task[]
}

export interface ProjectTasksData {
  projects: ProjectTasks[]
}

export interface WorkLogEntry {
  time: string
  project: string
  type: WorkLogType
  title: string
  detail?: string
}

export interface NewTaskInput {
  projectId: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee?: TaskAssignee
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  autoFallback?: boolean
  canRunOnCodex?: boolean
  requiresClaude?: boolean
  memo: string
  source?: string
  sourceRunId?: string
  sourceType?: Task['sourceType']
  taskPrompt?: string
  doneCriteria?: string[]
  allowed?: string[]
  forbidden?: string[]
  risk?: string
  blockedReason?: string
  unblockAction?: string
  nextQuestion?: string
  targetPath?: string
  targetApp?: string
}

export interface ProjectSummaryUpdate {
  currentTask?: string
  nextAction?: string
  progress?: number
  status?: ProjectStatus
  phase?: string
  url?: string
  blockers?: string[]
  excluded?: boolean
}

export interface NewProjectInput {
  id: string
  name: string
  status: ProjectStatus
  phase: string
  progress: number
  currentTask: string
  nextAction: string
  url?: string
}

export interface DashboardStats {
  total: number
  inProgress: number
  done: number
  blocked: number
}
