export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import StalledGoalCard from '@/components/stalled/StalledGoalCard'
import { readGoals } from '@/lib/goal-reader'
import { computeStalledGoals } from '@/lib/stalled-goals'

export default async function StalledGoalsPage() {
  const goalsData = await readGoals()
  const items = computeStalledGoals(goalsData.goals)
  const stalledCount = items.filter((item) => item.severity === 'stalled').length
  const warnCount = items.filter((item) => item.severity === 'warn').length

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="長期未解消ゴール"
        guide="承認したのに2週間以上動いていないゴールを、原因・解消方法・見込みで整理し、保留でキューを軽くします"
      />

      <section className="rounded-xl border-2 border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2">
          <Summary label="長期未解消" value={stalledCount} tone="rose" />
          <Summary label="警告" value={warnCount} tone="amber" />
        </div>
        <p className="mt-3 text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
          承認したのに2週間以上動いていないゴールを、原因・解消方法・見込みで整理し、保留でキューを軽くします。
        </p>
      </section>

      {goalsData.readError ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-100">goals.json を読み込めません。</p>
          <p className="mt-1 text-xs text-rose-700 dark:text-rose-200">{goalsData.readError}</p>
        </section>
      ) : null}

      {items.length === 0 ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">長期未解消または警告対象の active ゴールはありません。</p>
          <Link href="/goal-dashboard" className="mt-3 inline-flex rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            ゴール進行ボードを見る
          </Link>
        </section>
      ) : (
        <section className="space-y-3">
          {items.map((item) => (
            <StalledGoalCard key={item.goal.id} item={item} />
          ))}
        </section>
      )}
    </main>
  )
}

function Summary({ label, value, tone }: { label: string; value: number; tone: 'rose' | 'amber' }) {
  const cls = tone === 'rose' ? 'text-rose-700 dark:text-rose-200' : 'text-amber-700 dark:text-amber-200'
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800/60">
      <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 text-2xl font-black ${cls}`}>{value}件</p>
    </div>
  )
}
