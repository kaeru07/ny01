import { getStatusColor, getStatusLabel, getPriorityColor, getPriorityLabel } from '@/lib/progress-transform'

const STATUS_ICON: Record<string, string> = {
  backlog: '◌',
  pending_approval: '？',
  todo: '○',
  in_progress: '▶',
  impl_done: '◎',
  local_done: '✔',
  blocked: '⊘',
  done: '✓',
  deleted: '×',
  skipped: '−',
  active: '▶',
  user_action_pending: '⏳',
  deploy_ready: '🚀',
}

const PRIORITY_ICON: Record<string, string> = {
  high: '▲',
  medium: '●',
  low: '▽',
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const icon = STATUS_ICON[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
      {icon && <span className="leading-none">{icon}</span>}
      {getStatusLabel(status)}
    </span>
  )
}

interface PriorityBadgeProps {
  priority: string
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const icon = PRIORITY_ICON[priority]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(priority)}`}>
      {icon && <span className="leading-none">{icon}</span>}
      {getPriorityLabel(priority)}
    </span>
  )
}
