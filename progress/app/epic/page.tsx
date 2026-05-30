export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getEpics, getPendingApprovals } from '@/lib/operations-store'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: '実行中', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  paused: { label: '停止中', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  blocked: { label: '停止中', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  done: { label: '完了', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

export default async function EpicIndexPage() {
  const [epics, pending] = await Promise.all([getEpics(), getPendingApprovals()])
  const pendingByEpic = new Map<string, number>()
  for (const a of pending) {
    if (a.epicId) pendingByEpic.set(a.epicId, (pendingByEpic.get(a.epicId) ?? 0) + 1)
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI工場</h1>
        <p className="mt-0.5 text-sm text-gray-400">Epic（案件）単位で前回作業・決定・次回予定・承認待ちを確認する</p>
      </header>

      {epics.length === 0 ? (
        <p className="text-sm text-gray-400">Epic がまだありません。</p>
      ) : (
        <ul className="space-y-3">
          {epics.map((e) => {
            const p = pendingByEpic.get(e.epicId) ?? 0
            const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.paused
            return (
              <li key={e.epicId}>
                <Link
                  href={`/epic/${e.epicId}`}
                  className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-gray-900 dark:text-gray-100">{e.title}</h2>
                    {p > 0 ? (
                      <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                        承認待ち {p}
                      </span>
                    ) : (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{e.goal}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>{e.progress}%</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, e.progress))}%` }} />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
