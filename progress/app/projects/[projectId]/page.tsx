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
import { buildInbox } from '@/lib/command-center'
import { readGoals } from '@/lib/goal-reader'
import { formatDateTime, getProjectTaskStats } from '@/lib/progress-transform'

interface Props {
  params: { projectId: string }
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = params

  const [progressData, tasksData, allLogs, goalsData, inbox] = await Promise.all([
    readAppProgress(),
    readProjectTasks(),
    readWorkLog(),
    readGoals(),
    buildInbox(),
  ])

  const project = progressData.projects.find((p) => p.id === projectId)
  if (!project) notFound()

  const projectTasksEntry = tasksData.projects.find((p) => p.projectId === projectId)
  const tasks = projectTasksEntry?.tasks ?? []
  const ts = getProjectTaskStats(tasks)

  const projectLogs = allLogs.filter((l) => l.project === projectId).slice(0, 8)
  const achievedGoalIds = new Set(inbox.achievedGoalIds)
  const achievedGoals = goalsData.goals
    .filter((goal) => goal.projectId === projectId && achievedGoalIds.has(goal.id))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  const waitingReviews = inbox.reviews.filter((card) => card.projectId === projectId && card.goalId && achievedGoalIds.has(card.goalId))
  const latestWaitingReview = waitingReviews[0]
  const achievementHref = `/decide?tab=achievement&projectId=${encodeURIComponent(projectId)}`

  const taskStats = [
    { label: 'TODO', value: ts.todo, color: 'text-gray-600 dark:text-gray-300' },
    { label: '進行中', value: ts.inProgress, color: 'text-blue-600 dark:text-blue-400' },
    { label: '完了', value: ts.done, color: 'text-green-600 dark:text-green-400' },
    { label: 'ブロック', value: ts.blocked, color: 'text-red-600 dark:text-red-400' },
  ]

  return (
    <div className="space-y-4 px-4 pb-4 pt-4 lg:mx-auto lg:max-w-6xl">
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
      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
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

          <div className="grid grid-cols-4 gap-2 text-center">
            {taskStats.map((s) => (
              <div key={s.label} className="rounded-xl bg-gray-50 px-2 py-1.5 dark:bg-gray-900/30">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <main className="space-y-4">
          {/* Summary editor */}
          <ProjectSummaryEditor project={project} />

          {achievedGoals.length > 0 && (
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-3 shadow-sm dark:border-blue-900/50 dark:bg-blue-900/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-200">確認待ち</p>
                  <h2 className="mt-0.5 text-sm font-bold text-blue-950 dark:text-blue-50">
                    達成済みGoal {achievedGoals.length}件
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-blue-800/80 dark:text-blue-100/80">
                    完成・達成扱いになったGoalをこのプロジェクトから確認できます。未確認レビューは {waitingReviews.length}件です。
                  </p>
                </div>
                <Link
                  href={achievementHref}
                  className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                >
                  達成確認を開く
                </Link>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {achievedGoals.slice(0, 4).map((goal) => (
                  <div key={goal.id} className="rounded-xl bg-white p-2 dark:bg-gray-950">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-bold text-gray-900 dark:text-gray-100">{goal.title}</p>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                        確認対象
                      </span>
                    </div>
                    {(goal.summary || goal.description) && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        {goal.summary || goal.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {latestWaitingReview && (
                <p className="mt-2 text-[11px] text-blue-800/80 dark:text-blue-100/80">
                  最新の確認待ち: {latestWaitingReview.headline}
                </p>
              )}
            </section>
          )}

          {/* Tasks */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">タスク</h2>
            <div className="space-y-3">
              <TaskList tasks={tasks} projectId={projectId} />
              <TaskAddForm projectId={projectId} />
            </div>
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-4">
          {/* Exclude toggle */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">候補更新での処理対象</p>
            <ExcludeToggle projectId={projectId} excluded={project.excluded ?? false} />
          </div>

          {/* Blockers */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">ブロッカー</h2>
            <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <BlockersEditor projectId={projectId} blockers={project.blockers} />
            </div>
          </section>

          {/* Project logs */}
          {projectLogs.length > 0 && (
            <RecentLogs logs={projectLogs} />
          )}
        </aside>
      </div>
    </div>
  )
}
