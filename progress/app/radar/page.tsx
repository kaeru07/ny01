export const dynamic = 'force-dynamic'

import { readAppProgress } from '@/lib/progress-reader'
import { readWorkQueue } from '@/lib/session-reader'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { buildRadar, pickTopFocus, ganttDates } from '@/lib/radar'
import RadarBoard from '@/components/radar/RadarBoard'

export default async function RadarPage() {
  const [progressData, queueData, runs] = await Promise.all([
    readAppProgress(),
    readWorkQueue(),
    readExecutionRuns(),
  ])

  const radar = buildRadar(progressData.projects, queueData.items, runs)
  const focus = pickTopFocus(radar)
  const dates = ganttDates(21)

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
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
