export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readGoals, goalAchievement } from '@/lib/goal-reader'
import { getAutoQueueView } from '@/lib/auto-queue'
import { proposalCategoryOf } from '@/lib/command-center'
import type { Goal, GoalTodo } from '@/types/goal'

// ゴール達成率ダッシュボード: goals.json を読み、状態内訳・達成率・カテゴリを俯瞰する読み取り専用ページ。
// goal-planner(per-goal管理・proposed除外)とは別に、全体像と「進んでいない目標」を一目で出す。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'

const STATUS_ORDER: Array<{ key: Goal['status']; label: string; cls: string }> = [
  { key: 'active', label: '実行中', cls: 'text-green-700 dark:text-green-300' },
  { key: 'proposed', label: '承認待ち', cls: 'text-amber-700 dark:text-amber-300' },
  { key: 'paused', label: '後で(保留)', cls: 'text-gray-500 dark:text-gray-400' },
  { key: 'done', label: '完了', cls: 'text-blue-700 dark:text-blue-300' },
  { key: 'dropped', label: '取りやめ', cls: 'text-rose-600 dark:text-rose-400' },
  { key: 'archived', label: '保管', cls: 'text-gray-400' },
]

function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, pct))
  if (p >= 100) return 'bg-blue-500'
  if (p >= 60) return 'bg-green-500'
  if (p >= 30) return 'bg-amber-500'
  return 'bg-rose-400'
}

function isTodoComplete(todo: GoalTodo): boolean {
  return todo.status === 'done' || todo.status === 'skipped'
}

function isTodoInProgress(todo: GoalTodo): boolean {
  return String(todo.status) === 'in_progress' || String(todo.status) === 'active'
}

function todoSummary(goal: Goal): { done: number; total: number } {
  const total = goal.todos.length
  return { done: goal.todos.filter(isTodoComplete).length, total }
}

function goalHasExecutable(goal: Goal, goalProgressById: Map<string, { executable: number }>, executableGoalIds: Set<string>): boolean {
  const row = goalProgressById.get(goal.id)
  return (row?.executable ?? 0) > 0 || executableGoalIds.has(goal.id)
}

function stuckTodoCount(goal: Goal, hasExecutable: boolean): number {
  return goal.todos.filter((todo) => !isTodoComplete(todo) && !hasExecutable).length
}

function TodoConsumption({ goal, hasExecutable }: { goal: Goal; hasExecutable: boolean }) {
  const todos = [...goal.todos].sort((a, b) => a.order - b.order)
  if (todos.length === 0) {
    return (
      <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-[12px] text-gray-500 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-400">
        このゴールにはtodoがありません。
      </div>
    )
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {todos.map((todo) => {
        const complete = isTodoComplete(todo)
        const inProgress = isTodoInProgress(todo)
        const stuck = !complete && !hasExecutable
        return (
          <li
            key={todo.id}
            className={`rounded-lg border px-2.5 py-2 ${
              stuck
                ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30'
                : complete
                  ? 'border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-950/40'
                  : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/30'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-sm font-black ${complete ? 'text-gray-400 dark:text-gray-500' : stuck ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>
                {complete ? '✓' : '•'}
              </span>
              <span className={`min-w-0 flex-1 break-words text-sm font-semibold ${
                complete
                  ? 'text-gray-400 line-through dark:text-gray-500'
                  : stuck
                    ? 'text-amber-900 dark:text-amber-100'
                    : 'text-gray-800 dark:text-gray-100'
              }`}>
                {todo.title}
              </span>
              {complete && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {todo.status === 'skipped' ? 'skipped' : 'done'}
                </span>
              )}
              {inProgress && !complete && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  進行中
                </span>
              )}
              {stuck && (
                <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-black text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                  ⚠ 止まっている
                </span>
              )}
              {todo.role === 'human' && (
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  人手
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default async function GoalDashboardPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const [data, queue] = await Promise.all([readGoals(), getAutoQueueView()])
  const goals = data.goals
  const selectedGoalId = typeof searchParams?.goalId === 'string' ? searchParams.goalId : undefined

  const countBy = (s: Goal['status']) => goals.filter((g) => g.status === s).length
  const active = goals.filter((g) => g.status === 'active')
  const proposed = goals.filter((g) => g.status === 'proposed')
  const tryCount = proposed.filter((g) => proposalCategoryOf(g.proposalSource) === 'try').length
  const appCount = proposed.length - tryCount

  // 実行中ゴールの達成率（current/target）。達成率の低い順に並べ「進んでいない目標」を上に。
  const activeWithAch = active
    .map((g) => ({ g, ach: goalAchievement(g) }))
    .sort((a, b) => a.ach - b.ach)
  const avgAch = active.length > 0 ? Math.round(activeWithAch.reduce((s, x) => s + x.ach, 0) / active.length) : 0
  const goalProgressById = new Map(queue.goalProgress.map((row) => [row.goalId, row]))
  const executableGoalIds = new Set(queue.executable.map((item) => item.goalId).filter((goalId): goalId is string => Boolean(goalId)))
  const selectedGoal = selectedGoalId ? activeWithAch.find(({ g }) => g.id === selectedGoalId) : undefined

  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      {!selectedGoalId && (
        <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
          <h1 className="text-lg font-black text-gray-950 dark:text-white">ゴール×todo消化状況</h1>
          <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
            全ゴールの状態内訳と、実行中ゴールの達成率(今/目標)・配下todoの消化状況を閲覧します。進んでいない目標が上に出ます。
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STATUS_ORDER.map((s) => (
              <div key={s.key} className="rounded-lg bg-gray-50 p-2.5 text-center dark:bg-gray-800/50">
                <p className="text-[10px] font-semibold text-gray-400">{s.label}</p>
                <p className={`mt-0.5 text-lg font-black ${s.cls}`}>{countBy(s.key)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">実行中の平均達成率 {avgAch}%</span>
            <Link href="/decide?tab=goalApproval" className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/15 dark:text-amber-300">承認待ち {proposed.length}（試す{tryCount}/アプリ{appCount}）→</Link>
            <Link href="/goal-planner" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">目標を編集 →</Link>
          </div>
        </section>
      )}

      {selectedGoalId ? (
        <section className={card}>
          <Link href="/goal-dashboard" className="text-xs font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">← 一覧へ戻る</Link>
          {!selectedGoal ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-100">
              指定された実行中ゴールが見つかりません。
            </div>
          ) : (() => {
            const { g, ach } = selectedGoal
            const hasExecutable = goalHasExecutable(g, goalProgressById, executableGoalIds)
            const { done, total } = todoSummary(g)
            return (
              <>
                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="break-words text-lg font-black text-gray-950 dark:text-white">{g.title}</h1>
                    <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">todo {done}/{total} 完了</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-black text-gray-800 dark:bg-gray-800 dark:text-gray-100">
                    {g.current ?? 0}/{g.target ?? 100}（{ach}%）
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${bar(ach)}`} style={{ width: `${Math.max(2, Math.min(100, ach))}%` }} />
                </div>
                <TodoConsumption goal={g} hasExecutable={hasExecutable} />
              </>
            )
          })()}
        </section>
      ) : (
        <section className={card}>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">実行中ゴールの達成率（進んでいない順）</h2>
          {activeWithAch.length === 0 ? (
            <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">実行中のゴールはありません。</p>
          ) : (
            <ul className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {activeWithAch.map(({ g, ach }) => {
                const hasExecutable = goalHasExecutable(g, goalProgressById, executableGoalIds)
                const { done, total } = todoSummary(g)
                const stuckCount = stuckTodoCount(g, hasExecutable)
                return (
                  <li key={g.id}>
                    <Link
                      href={`/goal-dashboard?goalId=${encodeURIComponent(g.id)}`}
                      className="block h-full rounded-lg border border-gray-100 bg-gray-50/60 p-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-800 dark:bg-gray-950/30 dark:hover:border-blue-900/60 dark:hover:bg-blue-900/10"
                    >
                      <div className="flex h-full flex-col gap-2">
                        <div className="min-w-0">
                          <p className="line-clamp-3 break-words text-xs font-black leading-snug text-gray-900 dark:text-gray-100">{g.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">todo {done}/{total} 完了</span>
                            {stuckCount > 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">⚠ {stuckCount}件</span>}
                          </div>
                        </div>
                        <div className="mt-auto">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{g.current ?? 0}/{g.target ?? 100}</span>
                            <span className="text-base font-black text-gray-900 dark:text-gray-100">{ach}%</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className={`h-full rounded-full ${bar(ach)}`} style={{ width: `${Math.max(2, Math.min(100, ach))}%` }} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
