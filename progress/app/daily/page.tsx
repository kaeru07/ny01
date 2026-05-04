export const dynamic = 'force-dynamic'

import { readWorkLog, readAppProgress } from '@/lib/progress-reader'
import { getLogTypeIcon, getLogTypeColor } from '@/lib/progress-transform'
import type { WorkLogEntry } from '@/types/progress'

function toJSTDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

function groupByDate(logs: WorkLogEntry[]): Map<string, WorkLogEntry[]> {
  const groups = new Map<string, WorkLogEntry[]>()
  for (const log of logs) {
    const date = toJSTDate(log.time)
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(log)
  }
  return groups
}

export default async function DailyPage() {
  const [logs, progressData] = await Promise.all([readWorkLog(), readAppProgress()])

  const projectMap = Object.fromEntries(progressData.projects.map((p) => [p.id, p.name]))
  const grouped = groupByDate(logs)

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">日別進捗</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{grouped.size} 日分</p>
      </header>

      {grouped.size === 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">ログがありません</p>
      )}

      {Array.from(grouped.entries()).map(([date, dayLogs]) => {
        const completed = dayLogs.filter((l) => l.type === 'task_completed')
        const started = dayLogs.filter((l) => l.type === 'task_started')
        const added = dayLogs.filter((l) => l.type === 'task_added')
        const others = dayLogs.filter(
          (l) => !['task_completed', 'task_started', 'task_added'].includes(l.type),
        )

        return (
          <section key={date}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{date}</h2>
              <div className="flex gap-2">
                {completed.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium">
                    完了 {completed.length}
                  </span>
                )}
                {started.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium">
                    開始 {started.length}
                  </span>
                )}
                {added.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 font-medium">
                    追加 {added.length}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
              {dayLogs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 px-4 py-3 ${
                    i < dayLogs.length - 1 ? 'border-b border-gray-50 dark:border-gray-700' : ''
                  }`}
                >
                  <span className={`text-sm font-mono mt-0.5 flex-shrink-0 ${getLogTypeColor(log.type)}`}>
                    {getLogTypeIcon(log.type)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{log.title}</p>
                    {log.detail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{log.detail}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">
                        {projectMap[log.project] ?? log.project}
                      </span>
                      <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(log.time).toLocaleTimeString('ja-JP', {
                          timeZone: 'Asia/Tokyo',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
