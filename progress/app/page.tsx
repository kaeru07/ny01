export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress, readWorkLog } from '@/lib/progress-reader'
import { readProjectTasks } from '@/lib/progress-reader'
import { readWorkQueue, sortedQueueItems } from '@/lib/session-reader'
import { readGoals, findMainGoal } from '@/lib/goal-reader'
import { calcDashboardStats, sortByAttention } from '@/lib/progress-transform'
import StatsBar from '@/components/dashboard/StatsBar'
import NextActions from '@/components/dashboard/NextActions'
import ProjectCards from '@/components/dashboard/ProjectCards'
import RecentLogs from '@/components/dashboard/RecentLogs'
import GoalSummaryCard from '@/components/dashboard/GoalSummaryCard'

export default async function DashboardPage() {
  const [progressData, logs, tasksData, queueData, goalsData] = await Promise.all([
    readAppProgress(),
    readWorkLog(10),
    readProjectTasks(),
    readWorkQueue(),
    readGoals(),
  ])

  const mainGoal = findMainGoal(goalsData)
  const mainGoalProjectName = mainGoal
    ? progressData.projects.find((p) => p.id === mainGoal.projectId)?.name
    : undefined

  const stats = calcDashboardStats(progressData.projects)

  const taskCounts: Record<string, number> = {}
  for (const pt of tasksData.projects) {
    taskCounts[pt.projectId] = pt.tasks.length
  }

  const sorted = sortByAttention(progressData.projects)

  const pendingCount = tasksData.projects.reduce(
    (count, pt) => count + pt.tasks.filter((t) => t.status === 'pending_approval').length,
    0
  )

  const queueActive = sortedQueueItems(queueData.items).filter(
    (i) => i.status === 'queued' || i.status === 'in_progress'
  )

  const todayLabel = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ダッシュボード</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{todayLabel}</p>
      </header>

      {/* Queue / morning CTA */}
      {queueActive.length > 0 ? (
        <Link href="/queue">
          <div className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white rounded-2xl p-4 flex items-center gap-4 transition-colors">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-500/50 flex items-center justify-center">
              <span className="text-2xl font-bold">{queueActive.length}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-tight">今日のキューを開く</p>
              <p className="text-sm text-blue-200 mt-0.5">{queueActive.length}件 待機中 — 作業プロンプトをコピー</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-5 h-5 flex-shrink-0 text-blue-200">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/morning">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-[0.99] rounded-2xl p-4 flex flex-col gap-1.5 transition-colors">
              <span className="text-2xl">🌅</span>
              <span className="text-sm font-semibold leading-tight">朝会を開く</span>
              <span className="text-xs opacity-75">今日の作業を計画する</span>
            </div>
          </Link>
          <Link href="/tasks">
            <div className={`rounded-2xl p-4 flex flex-col gap-1.5 transition-colors active:scale-[0.99] ${
              pendingCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
              <span className="text-2xl font-bold">{pendingCount}</span>
              <span className="text-sm font-semibold leading-tight">承認待ちToDo</span>
              <span className="text-xs opacity-75">{pendingCount > 0 ? `${pendingCount}件 着手判定待ち` : 'ToDo管理を開く'}</span>
            </div>
          </Link>
        </div>
      )}

      {mainGoal ? (
        <GoalSummaryCard goal={mainGoal} projectName={mainGoalProjectName} />
      ) : (
        <Link href="/goal-planner">
          <div className="rounded-2xl border border-dashed border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-xl">🎯</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">メイン目標を設定する</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Goal Planner で目標を入力 → 自動分解 → 一括登録</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-blue-500 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      <StatsBar data={stats} />
      <NextActions projects={progressData.projects} />
      <ProjectCards projects={sorted} taskCounts={taskCounts} title="案件一覧" />
      <RecentLogs logs={logs} />
    </div>
  )
}
