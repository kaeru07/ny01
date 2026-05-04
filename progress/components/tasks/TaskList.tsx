import type { Task } from '@/types/progress'
import { PriorityBadge } from './TaskBadge'
import TaskStatusControl from './TaskStatusControl'
import { formatDateTime, getAssigneeColor, getAssigneeLabel } from '@/lib/progress-transform'

interface TaskListProps {
  tasks: Task[]
  projectId?: string
}

export default function TaskList({ tasks, projectId }: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">タスクがありません</p>
    )
  }

  const sorted = [...tasks].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      in_progress: 0,
      blocked: 1,
      todo: 2,
      impl_done: 3,
      local_done: 4,
      done: 5,
    }
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const sa = statusOrder[a.status] ?? 9
    const sb = statusOrder[b.status] ?? 9
    if (sa !== sb) return sa - sb
    const pa = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 9
    const pb = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 9
    return pa - pb
  })

  return (
    <ul className="space-y-2">
      {sorted.map((task) => (
        <li
          key={task.id}
          className={`rounded-xl border p-3 transition-opacity ${
            task.status === 'done'
              ? 'opacity-60 bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <p
              className={`text-sm font-medium leading-snug flex-1 ${
                task.status === 'done' ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'
              }`}
            >
              {task.status !== 'done' && task.assignee === 'user' && (
                <span className="mr-1 text-orange-500 text-xs font-bold">👤</span>
              )}
              {task.title}
            </p>
            <div className="flex items-center gap-1 flex-shrink-0">
              {task.assignee && task.assignee !== 'claude' && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getAssigneeColor(task.assignee)}`}>
                  {getAssigneeLabel(task.assignee)}
                </span>
              )}
              <PriorityBadge priority={task.priority} />
            </div>
          </div>

          {task.memo && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2">{task.memo}</p>
          )}

          <div className="flex items-center justify-between gap-2">
            {projectId ? (
              <TaskStatusControl
                taskId={task.id}
                projectId={projectId}
                currentStatus={task.status}
              />
            ) : (
              <span className="text-xs text-gray-400 dark:text-gray-500">{task.status}</span>
            )}
            <p className="text-xs text-gray-300 dark:text-gray-600 flex-shrink-0">{formatDateTime(task.updatedAt)}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
