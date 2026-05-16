export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress } from '@/lib/progress-reader'
import { readGoals, findMainGoal, calcGoalProgress, calcPhaseProgress } from '@/lib/goal-reader'
import GoalPlannerForm from '@/components/goals/GoalPlannerForm'
import GoalListItem from '@/components/goals/GoalListItem'
import type { Goal } from '@/types/goal'

export default async function GoalPlannerPage() {
  const [progress, goalsData] = await Promise.all([
    readAppProgress(),
    readGoals(),
  ])

  const projects = progress.projects
    .filter((p) => !p.excluded)
    .map((p) => ({ id: p.id, name: p.name }))

  const mainGoal = findMainGoal(goalsData)

  return (
    <div className="px-4 pt-6 pb-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goal Planner</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          目標を入力 → Claude / Codex に分解させる → JSONを貼り付けて一括登録
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
          <GoalMiniStats goal={mainGoal} />
        </section>
      )}

      <GoalPlannerForm projects={projects} hasMainGoal={!!mainGoal} />

      {goalsData.goals.length > 0 && (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">登録済みの目標 ({goalsData.goals.length}件)</h2>
          <div className="space-y-2">
            {goalsData.goals.map((g) => {
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
                />
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

function GoalMiniStats({ goal }: { goal: Goal }) {
  const progress = calcGoalProgress(goal)
  const phases = calcPhaseProgress(goal)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span>全体進捗</span>
        <span className="font-semibold text-blue-700 dark:text-blue-300">{progress.ratio}%</span>
        <span className="text-gray-400 dark:text-gray-500">({progress.doneTodos} / {progress.totalTodos})</span>
      </div>
      <div className="h-2 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
        <div className="h-full bg-blue-600 dark:bg-blue-500 transition-all" style={{ width: `${progress.ratio}%` }} />
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
