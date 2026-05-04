import Link from 'next/link'
import type { WorkLogEntry } from '@/types/progress'
import { getLogTypeIcon, getLogTypeColor, formatDateTime } from '@/lib/progress-transform'

interface RecentLogsProps {
  logs: WorkLogEntry[]
}

export default function RecentLogs({ logs }: RecentLogsProps) {
  if (logs.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">最近のログ</h2>
        <Link href="/logs" className="text-xs text-blue-500 hover:text-blue-600 dark:hover:text-blue-400">
          すべて見る
        </Link>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {logs.slice(0, 5).map((log, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3 ${
              i < logs.slice(0, 5).length - 1 ? 'border-b border-gray-50 dark:border-gray-700' : ''
            }`}
          >
            <span className={`text-base font-mono mt-0.5 flex-shrink-0 ${getLogTypeColor(log.type)}`}>
              {getLogTypeIcon(log.type)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-snug">{log.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">{log.project}</span>
                <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(log.time)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
