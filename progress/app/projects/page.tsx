export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress, readProjectTasks } from '@/lib/progress-reader'
import { StatusBadge } from '@/components/tasks/TaskBadge'
import { formatDateTime, getProjectTaskStats } from '@/lib/progress-transform'



export default async function ProjectsPage() {
  const [progressData, tasksData] = await Promise.all([
    readAppProgress(),
    readProjectTasks(),
  ])

  const taskMap: Record<string, ReturnType<typeof getProjectTaskStats>> = {}
  for (const pt of tasksData.projects) {
    taskMap[pt.projectId] = getProjectTaskStats(pt.tasks)
  }

  const sorted = [...progressData.projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-5 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">案件</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{sorted.length} 件</p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          新規追加
        </Link>
      </header>

      <div className="space-y-3">
        {sorted.map((project) => {
          const ts = taskMap[project.id]
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 hover:shadow-md hover:border-blue-100 dark:hover:border-blue-800 transition-all active:scale-[0.99]">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">{project.name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-gray-400 dark:text-gray-500">{project.phase}</p>
                      {project.excluded && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">対象外</span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                    <span>進捗</span>
                    <span className="font-medium text-gray-600 dark:text-gray-300">{project.progress}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1 mb-3">
                  <span className="text-gray-300 dark:text-gray-600 text-xs mr-1">現在:</span>
                  {project.currentTask}
                </p>

                {project.blockers.length > 0 && (
                  <div className="mb-3 space-y-0.5">
                    {project.blockers.map((b, i) => (
                      <p key={i} className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                        <span>⚠</span> {b}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500">
                  <span>{formatDateTime(project.updatedAt)}</span>
                  {ts && (
                    <span>
                      {ts.done}/{ts.total} 完了
                      {ts.blocked > 0 && <span className="text-red-400 ml-1">· {ts.blocked} ブロック</span>}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
