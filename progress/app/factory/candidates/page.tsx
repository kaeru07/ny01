export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'
import type { CandidatePriority } from '@/lib/app-factory-candidates'

const PRIORITY_BADGE: Record<CandidatePriority, { label: string; cls: string }> = {
  high: { label: '優先度: 高', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  medium: { label: '優先度: 中', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  low: { label: '優先度: 低', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
}

export default async function FactoryCandidatesPage() {
  const queue = await getAppFactoryCandidates()

  return (
    <div className="space-y-4 px-4 pb-4 pt-6">
      <header className="space-y-1">
        <Link href="/epic" className="text-xs text-gray-400 hover:underline">
          ← AI工場
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">アプリ開発候補キュー</h1>
        <p className="text-sm text-gray-400">{queue.description}</p>
      </header>

      {queue.candidates.length === 0 ? (
        <p className="text-sm text-gray-400">候補がまだありません。</p>
      ) : (
        <ul className="space-y-3">
          {queue.candidates.map((c) => {
            const badge = PRIORITY_BADGE[c.priority] ?? PRIORITY_BADGE.low
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{c.title}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-gray-400">目的</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{c.purpose}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-400">収益化仮説</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{c.monetizationHypothesis}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-gray-400">次アクション</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{c.nextAction}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    状態: {c.status}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      c.factorySafe
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {c.factorySafe ? 'Factory 着手可' : 'ユーザー操作あり'}
                  </span>
                  {c.sourceProjectId && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      project: {c.sourceProjectId}
                    </span>
                  )}
                </div>
                {c.factoryNote && (
                  <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{c.factoryNote}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
