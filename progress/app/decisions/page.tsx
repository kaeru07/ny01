export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getOperationalDecisions } from '@/lib/operations-store'

function fmt(dt: string): string {
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function DecisionsPage() {
  const decisions = (await getOperationalDecisions()).slice().reverse()

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">決定事項（Decision Log）</h1>
        <p className="mt-0.5 text-sm text-gray-400">承認の決定が時系列で記録される。AI はこの判断と矛盾する作業を実行しない。</p>
      </header>

      {decisions.length === 0 ? (
        <p className="text-sm text-gray-400">まだ確定した決定はありません。</p>
      ) : (
        <ul className="space-y-2">
          {decisions.map((d) => (
            <li key={d.decisionId} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-900 dark:text-gray-100">
                <span className="text-gray-500">{d.topic}</span> → <span className="font-medium">{d.decision}</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-400">
                {fmt(d.decidedAt)}
                {d.epicId && (
                  <>
                    {' · '}
                    <Link href={`/epic/${d.epicId}`} className="text-blue-600 hover:underline">{d.epicId}</Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
