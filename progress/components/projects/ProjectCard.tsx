import Link from 'next/link'
import type { Project } from '@/types/progress'
import { StatusBadge } from '@/components/tasks/TaskBadge'
import { formatDateTime, getStagnation } from '@/lib/progress-transform'

interface ProjectCardProps {
  project: Project
  taskCount?: number
}

const progressBarColor: Record<string, string> = {
  blocked: 'bg-red-400',
  done: 'bg-green-500',
}

export default function ProjectCard({ project, taskCount }: ProjectCardProps) {
  const isBlocked = project.status === 'blocked'
  const barColor = progressBarColor[project.status] ?? 'bg-blue-500'
  const stagnation = getStagnation(project)

  return (
    <Link href={`/projects/${project.id}`}>
      <div className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all active:scale-[0.99] ${
        isBlocked
          ? 'border-red-200 dark:border-red-900/50 hover:border-red-300 dark:hover:border-red-800'
          : 'border-gray-100 dark:border-gray-700 hover:border-blue-100 dark:hover:border-blue-800'
      }`}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{project.name}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{project.phase}</p>
          </div>
          <StatusBadge status={project.status} />
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
            <span>進捗</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{project.progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1 mb-2">
          <span className="text-gray-400 dark:text-gray-500 text-xs">現在: </span>
          {project.currentTask}
        </p>

        {project.blockers.length > 0 && (
          <div className="mb-2 rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2">
            {project.blockers.map((b, i) => (
              <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-start gap-1.5 leading-snug">
                <span className="flex-shrink-0 mt-0.5">▲</span>
                <span>{b}</span>
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(project.updatedAt)}</span>
            {stagnation.level !== 'fresh' && (
              <span className={`flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                stagnation.level === 'stalled'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-500'
              }`}>
                ◷ {stagnation.days}日放置
              </span>
            )}
          </div>
          {taskCount !== undefined && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{taskCount} タスク</span>
          )}
        </div>
      </div>
    </Link>
  )
}
