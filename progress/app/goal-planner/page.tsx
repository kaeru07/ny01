export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress } from '@/lib/progress-reader'
import { readGoals, findMainGoal, calcGoalProgress, calcPhaseProgress } from '@/lib/goal-reader'
import { getAutoQueueView } from '@/lib/auto-queue'
import FilterBar from '@/components/newux/FilterBar'
import FilterChips from '@/components/newux/FilterChips'
import GoalPlannerForm from '@/components/goals/GoalPlannerForm'
import GoalListItem from '@/components/goals/GoalListItem'
import { buildProgressFilterUrl, parseProgressFilters, updateFilterParam } from '@/lib/progress-filters'
import type { GoalProgressRow } from '@/types/auto-queue'
import type { Goal } from '@/types/goal'

function matchesGoal(goal: Goal, q?: string): boolean {
  if (!q) return true
  const haystack = [goal.title, goal.summary, goal.description, goal.projectId, goal.status, ...goal.todos.map((todo) => todo.title)].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

export default async function GoalPlannerPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const [progress, goalsData, autoQueue] = await Promise.all([
    readAppProgress(),
    readGoals(),
    getAutoQueueView(),
  ])
  const filters = parseProgressFilters(searchParams)

  const projects = progress.projects
    .filter((p) => !p.excluded)
    .map((p) => ({ id: p.id, name: p.name }))

  const mainGoal = findMainGoal(goalsData)
  const queueProgressByGoal = new Map(autoQueue.goalProgress.map((row) => [row.goalId, row]))
  const filteredGoals = goalsData.goals.filter((goal) => {
    if (filters.projectId && goal.projectId !== filters.projectId) return false
    if (filters.status && goal.status !== filters.status) return false
    if (!matchesGoal(goal, filters.q)) return false
    return true
  })

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goal Planner</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Goalと自動実行キューを同じ進捗で見る。登録はJSON一括取り込みで追加できます。
        </p>
      </header>

      {mainGoal && (
        <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">現在のメイン目標</span>
            <Link href="/" className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline">ダッシュボードを見る</Link>
          </div>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{mainGoal.title}</p>
          {mainGoal.summary && <p className="text-xs text-gray-600 dark:text-gray-300">{mainGoal.summary}</p>}
          <GoalMiniStats goal={mainGoal} queueProgress={queueProgressByGoal.get(mainGoal.id)} />
        </section>
      )}

      <GoalPlannerForm projects={projects} hasMainGoal={!!mainGoal} />

      <section className="space-y-2">
        <FilterBar
          basePath="/goal-planner"
          filters={filters}
          quickFilters={[
            { key: 'all', label: 'すべて', patch: { status: undefined, projectId: undefined, q: undefined }, active: !filters.status && !filters.projectId && !filters.q },
            { key: 'active', label: 'active', patch: { status: 'active' }, active: filters.status === 'active' },
            { key: 'paused', label: 'paused', patch: { status: 'paused' }, active: filters.status === 'paused' },
            { key: 'done', label: 'done', patch: { status: 'done' }, active: filters.status === 'done' },
          ]}
          selectFilters={[
            { key: 'projectId', label: 'Project', placeholder: 'すべてのProject', options: projects.map((project) => ({ value: project.id, label: project.name })) },
            { key: 'status', label: 'status', placeholder: 'すべての状態', options: ['active', 'paused', 'done', 'dropped', 'archived'].map((value) => ({ value, label: value })) },
          ]}
          showSearch
        />
        <FilterChips
          clearHref="/goal-planner"
          chips={[
            { key: 'projectId', label: `Project: ${projects.find((project) => project.id === filters.projectId)?.name ?? filters.projectId}`, active: Boolean(filters.projectId), href: buildProgressFilterUrl('/goal-planner', updateFilterParam(filters, { projectId: undefined })) },
            { key: 'status', label: `状態: ${filters.status}`, active: Boolean(filters.status), href: buildProgressFilterUrl('/goal-planner', updateFilterParam(filters, { status: undefined })) },
            { key: 'q', label: `検索: ${filters.q}`, active: Boolean(filters.q), href: buildProgressFilterUrl('/goal-planner', updateFilterParam(filters, { q: undefined })) },
          ]}
        />
      </section>

      {filteredGoals.length > 0 ? (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">登録済みの目標 ({filteredGoals.length}/{goalsData.goals.length}件)</h2>
          <div className="space-y-2">
            {filteredGoals.map((g) => {
              const progress = calcGoalProgress(g)
              return (
                <GoalListItem
                  key={g.id}
                  goalId={g.id}
                  title={g.title}
                  isMain={goalsData.mainGoalId === g.id}
                  phaseCount={g.phases.length}
                  todoCount={g.todos.length}
                  ratio={progress.ratio}
                  queueProgress={queueProgressByGoal.get(g.id)}
                />
              )
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
          条件に一致するGoalはありません。<Link href="/goal-planner" className="ml-2 font-bold text-blue-600 dark:text-blue-300">クリア</Link>
        </section>
      )}
    </div>
  )
}

function GoalMiniStats({ goal, queueProgress }: { goal: Goal; queueProgress?: GoalProgressRow }) {
  const progress = calcGoalProgress(goal)
  const phases = calcPhaseProgress(goal)
  const ratio = queueProgress?.ratio ?? progress.ratio
  const done = queueProgress?.done ?? progress.doneTodos
  const total = queueProgress?.total ?? progress.totalTodos

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span>全体進捗</span>
        <span className="font-semibold text-blue-700 dark:text-blue-300">{ratio}%</span>
        <span className="text-gray-400 dark:text-gray-500">({done} / {total})</span>
      </div>
      <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
        <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all" style={{ width: `${ratio}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <MiniStat label="次回候補" value={queueProgress?.nextCandidateCount ?? 0} />
        <MiniStat label="実行可能" value={queueProgress?.executable ?? 0} />
        <MiniStat label="判断待ち" value={queueProgress?.waitingUser ?? 0} />
        <MiniStat label="レビュー待ち" value={queueProgress?.reviewWaiting ?? 0} />
        <MiniStat label="候補外" value={queueProgress?.manual ?? 0} />
      </div>
      <div className="rounded-xl bg-white/70 dark:bg-gray-900/30 border border-blue-100 dark:border-blue-900/40 px-3 py-2 space-y-1">
        <p className="text-xs text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-800 dark:text-gray-100">次にやるべきこと:</span> {queueProgress?.nextActionTitle ?? '実行可能候補なし'}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-gray-800 dark:text-gray-100">最新作業:</span> {queueProgress?.latestWorkTitle ?? 'まだ作業履歴なし'}
        </p>
      </div>
      {phases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
          {phases.map((p) => (
            <div key={p.phaseId} className="rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/40 px-2 py-1.5">
              <p className="text-[11px] text-gray-700 dark:text-gray-200 font-medium truncate">{p.title}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500">{p.done} / {p.total} ・ {p.ratio}%</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/70 dark:bg-gray-900/30 border border-blue-100 dark:border-blue-900/40 px-2 py-1.5 text-center">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
