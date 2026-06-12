export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import { buildProjectPortfolio } from '@/lib/command-center'

// Projects = いま動いているプロジェクトの一覧。状態 / 次の作業 / 最終更新 / 収益化状況。

const toneClass: Record<string, string> = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  wait: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  done: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

function fmt(dt?: string): string {
  if (!dt) return '不明'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

export default async function PortfolioPage() {
  const projects = await buildProjectPortfolio()

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide title="Projects" guide="進行中プロジェクトの状況を確認します。「あなたの作業待ち」のものから手を付けるのがおすすめです。" />

      <ul className="space-y-3">
        {projects.map((p) => (
          <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.name}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClass[p.statusTone]}`}>{p.statusLabel}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${p.progressPct}%` }} />
              </div>
              <span className="w-12 text-right text-sm font-bold text-gray-900 dark:text-gray-100">{p.progressPct}%</span>
            </div>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-400">残作業</dt>
                <dd className="text-gray-700 dark:text-gray-200">{p.remainingWorkCount}作業</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-400">次の作業</dt>
                <dd className="line-clamp-2 text-gray-700 dark:text-gray-200">{p.nextWork}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-400">最終更新</dt>
                <dd className="text-gray-700 dark:text-gray-200">{fmt(p.updatedAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-400">収益化</dt>
                <dd className="text-gray-700 dark:text-gray-200">{p.monetizationLabel}</dd>
              </div>
            </dl>
          </li>
        ))}
        {projects.length === 0 && (
          <li className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            動いているプロジェクトはありません。
          </li>
        )}
      </ul>

      <p className="text-center text-[11px] text-gray-400">
        旧「案件」一覧（全{'15'}件・休止中含む）は Legacy → 案件 にあります
      </p>
    </div>
  )
}
