import type { Project, Task, DashboardStats } from '@/types/progress'

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    backlog: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    pending_approval: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    active: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    done: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    blocked: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    archived: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    todo: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    impl_done: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    local_done: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    deleted: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
    skipped: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
    user_action_pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    deploy_ready: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

export function getAssigneeColor(assignee: string): string {
  const map: Record<string, string> = {
    claude: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    user: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    both: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  }
  return map[assignee] ?? 'bg-gray-100 text-gray-600'
}

export function getAssigneeLabel(assignee: string): string {
  const map: Record<string, string> = {
    claude: 'Claude',
    user: 'ユーザー',
    both: '両者',
  }
  return map[assignee] ?? assignee
}

export function isClaudeEligible(task: Task): boolean {
  const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'impl_done', 'local_done']
  const isOpen = OPEN_STATUSES.includes(task.status)
  const assignee = task.assignee ?? 'claude'
  return isOpen && (assignee === 'claude' || assignee === 'both')
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  }
  return map[priority] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export function getLogTypeIcon(type: string): string {
  const map: Record<string, string> = {
    task_started: '▶',
    task_completed: '✓',
    task_failed: '✗',
    task_added: '+',
    task_status_updated: '↻',
    project_summary_updated: '✎',
    blockers_updated: '⚠',
    project_added: '★',
    blocker: '⚠',
    summary: '◎',
  }
  return map[type] ?? '·'
}

export function getLogTypeColor(type: string): string {
  const map: Record<string, string> = {
    task_started: 'text-blue-500',
    task_completed: 'text-green-500',
    task_failed: 'text-red-500',
    task_added: 'text-purple-500',
    task_status_updated: 'text-indigo-500',
    project_summary_updated: 'text-teal-600',
    blockers_updated: 'text-orange-500',
    project_added: 'text-violet-600',
    blocker: 'text-orange-500',
    summary: 'text-gray-500',
  }
  return map[type] ?? 'text-gray-400'
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    backlog: 'Backlog',
    pending_approval: '承認待ち',
    in_progress: '進行中',
    active: '稼働中',
    done: '完了',
    blocked: 'ブロック',
    archived: 'アーカイブ',
    todo: 'TODO',
    impl_done: '実装完了',
    local_done: 'ローカル確認済',
    deleted: '削除済み',
    skipped: 'スキップ',
    user_action_pending: 'ユーザー待ち',
    deploy_ready: 'デプロイ準備完了',
  }
  return map[status] ?? status
}

export function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }
  return map[priority] ?? priority
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  })
}

export function calcDashboardStats(projects: Project[]): DashboardStats {
  const ACTIVE_STATUSES = ['in_progress', 'active', 'user_action_pending', 'deploy_ready']
  return {
    total: projects.length,
    inProgress: projects.filter((p) => ACTIVE_STATUSES.includes(p.status)).length,
    done: projects.filter((p) => p.status === 'done').length,
    blocked: projects.filter((p) => p.status === 'blocked').length,
  }
}

export function getProjectTaskStats(tasks: Task[]) {
  const DONE_FAMILY = ['done', 'impl_done', 'local_done']
  const BACKLOG_FAMILY = ['backlog', 'todo']
  return {
    total: tasks.length,
    todo: tasks.filter((t) => BACKLOG_FAMILY.includes(t.status)).length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => DONE_FAMILY.includes(t.status)).length,
    blocked: tasks.filter((t) => t.status === 'blocked').length,
  }
}
