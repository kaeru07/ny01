export const dynamic = 'force-dynamic'

import { readAppProgress } from '@/lib/progress-reader'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { buildAutoQueue } from '@/lib/auto-queue'
import { buildRadar, pickTopFocus, ganttDates } from '@/lib/radar'
import RadarBoard from '@/components/radar/RadarBoard'

export default async function RadarPage() {
  const [progressData, queue, runs] = await Promise.all([
    readAppProgress(),
    buildAutoQueue(),
    readExecutionRuns(),
  ])

  const radar = buildRadar(progressData.projects, queue.candidates, runs)
  const focus = pickTopFocus(radar)
  const dates = ganttDates(21)

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">案件レーダー</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          {radar.length} 案件 · 放置 {radar.filter((r) => r.status === '放置').length} · レビュー待ち{' '}
          {radar.filter((r) => r.status === 'レビュー待ち').length}
        </p>
      </header>

      <RadarBoard radar={radar} focus={focus} dates={dates} />
    </div>
  )
}
