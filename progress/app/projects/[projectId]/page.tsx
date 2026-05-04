export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { readAppProgress, readProjectTasks, readWorkLog } from '@/lib/progress-reader'
import TaskList from '@/components/tasks/TaskList'
import TaskAddForm from '@/components/tasks/TaskAddForm'
import RecentLogs from '@/components/dashboard/RecentLogs'
import ProjectSummaryEditor from '@/components/projects/ProjectSummaryEditor'
import BlockersEditor from '@/components/projects/BlockersEditor'
import ExcludeToggle from '@/components/projects/ExcludeToggle'
import { formatDateTime, getProjectTaskStats } from '@/lib/progress-transform'

interface Props {
  params: { projectId: string }
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = params

  const [progressData, tasksData, allLogs] = await Promise.all([
    readAppProgress(),
    readProjectTasks(),
    readWorkLog(),
  ])

  const project = progressData.projects.find((p) => p.id === projectId)
  if (!project) notFound()

  const projectTasksEntry = tasksData.projects.find((p) => p.projectId === projectId)
  const tasks = projectTasksEntry?.tasks ?? []
  const ts = getProjectTaskStats(tasks)

  const projectLogs = allLogs.filter((l) => l.project === projectId).slice(0, 8)

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <header>
        <Link href="/projects" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 mb-3">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          案件一覧
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{project.name}</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{project.phase}</p>
          </div>
        </div>
        <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">更新: {formatDateTime(project.updatedAt)}</p>
      </header>

      {/* Progress + task stats */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-500 dark:text-gray-400">進捗</span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">{project.progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center pt-1">
          {[
            { label: 'TODO', value: ts.todo, color: 'text-gray-600 dark:text-gray-300' },
            { label: '進行中', value: ts.inProgress, color: 'text-blue-600 dark:text-blue-400' },
            { label: '完了', value: ts.done, color: 'text-green-600 dark:text-green-400' },
            { label: 'ブロック', value: ts.blocked, color: 'text-red-600 dark:text-red-400' },
          ].map((s) => (
            <div key={s.label}>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Exclude toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">候補更新での処理対象</p>
        <ExcludeToggle projectId={projectId} excluded={project.excluded ?? false} />
      </div>

      {/* Summary editor */}
      <ProjectSummaryEditor project={project} />

      {/* Blockers */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">ブロッカー</h2>
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
          <BlockersEditor projectId={projectId} blockers={project.blockers} />
        </div>
      </section>

      {/* Tasks */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">タスク</h2>
        <div className="space-y-3">
          <TaskList tasks={tasks} projectId={projectId} />
          <TaskAddForm projectId={projectId} />
        </div>
      </section>

      {/* Project logs */}
      {projectLogs.length > 0 && (
        <RecentLogs logs={projectLogs} />
      )}
    </div>
  )
}
