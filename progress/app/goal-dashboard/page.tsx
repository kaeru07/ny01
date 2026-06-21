export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readGoals, goalAchievement } from '@/lib/goal-reader'
import { proposalCategoryOf } from '@/lib/command-center'
import type { Goal } from '@/types/goal'

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

export default async function GoalDashboardPage() {
  const data = await readGoals()
  const goals = data.goals

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

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h1 className="text-lg font-black text-gray-950 dark:text-white">ゴール達成率ダッシュボード</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          全ゴールの状態内訳と、実行中ゴールの達成率(今/目標)を俯瞰します。進んでいない目標が上に出ます。
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

      <section className={card}>
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">実行中ゴールの達成率（進んでいない順）</h2>
        {activeWithAch.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">実行中のゴールはありません。</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {activeWithAch.map(({ g, ach }) => (
              <li key={g.id}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate text-[12px] font-semibold text-gray-800 dark:text-gray-100">{g.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-gray-500 dark:text-gray-400">{g.current ?? 0}/{g.target ?? 100}（{ach}%）</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${bar(ach)}`} style={{ width: `${Math.max(2, Math.min(100, ach))}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
