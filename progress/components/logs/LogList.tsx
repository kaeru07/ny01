import type { WorkLogEntry } from '@/types/progress'
import { getLogTypeIcon, getLogTypeColor, formatDateTime } from '@/lib/progress-transform'

interface LogListProps {
  logs: WorkLogEntry[]
}

export default function LogList({ logs }: LogListProps) {
  if (logs.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">ログがありません</p>
  }

  let lastDate = ''

  return (
    <div className="space-y-1">
      {logs.map((log, i) => {
        const date = new Date(log.time).toLocaleDateString('ja-JP', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const showDate = date !== lastDate
        lastDate = date

        return (
          <div key={i}>
            {showDate && (
              <div className="pt-4 pb-1 first:pt-0">
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{date}</p>
              </div>
            )}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-4 py-3 flex items-start gap-3">
              <span className={`text-base font-mono mt-0.5 flex-shrink-0 ${getLogTypeColor(log.type)}`}>
                {getLogTypeIcon(log.type)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-800 dark:text-gray-100 leading-snug">{log.title}</p>
                {log.detail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{log.detail}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">{log.project}</span>
                  <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateTime(log.time)}</span>
                  <span className="text-xs text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">{log.type}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
