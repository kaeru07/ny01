'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { MonetizationCandidate, CandidateStatus } from '@/types/monetization'
import { CANDIDATE_STATUSES } from '@/types/monetization'
import { statusMeta, scoreColor, blueOceanMeta, levelMeta } from '@/lib/monetization-ui'

function Stat({ label, value, cls }: { label: string; value?: string; cls?: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col rounded-lg bg-gray-50 px-2 py-1 dark:bg-gray-800/60">
      <span className="text-[10px] leading-none text-gray-400">{label}</span>
      <span className={`text-xs font-semibold leading-tight ${cls ?? 'text-gray-700 dark:text-gray-200'}`}>{value}</span>
    </div>
  )
}

export default function MonetizationList({ candidates }: { candidates: MonetizationCandidate[] }) {
  const [filter, setFilter] = useState<CandidateStatus | 'all'>('all')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of candidates) m.set(c.status, (m.get(c.status) ?? 0) + 1)
    return m
  }, [candidates])

  const visible = filter === 'all' ? candidates : candidates.filter((c) => c.status === filter)

  return (
    <div className="space-y-3">
      {/* 状態フィルタ（横スクロールせず折り返す） */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
          }`}
        >
          すべて {candidates.length}
        </button>
        {CANDIDATE_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => {
          const meta = statusMeta(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filter === s ? 'ring-2 ring-blue-400 ' + meta.cls : meta.cls
              }`}
            >
              {meta.label} {counts.get(s)}
            </button>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
          候補がありません。右上の「＋候補追加」または AI工場の定例発掘で追加されます。
        </p>
      )}

      {/* カード（縦並び・iPhone優先） */}
      <div className="space-y-3">
        {visible.map((c) => {
          const st = statusMeta(c.status)
          const bo = blueOceanMeta(c.blueOcean)
          const comp = levelMeta(c.competition, true)
          return (
            <Link
              key={c.id}
              href={`/monetization/${c.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold leading-none ${scoreColor(c.score)}`}
                >
                  {c.score}
                  <span className="mt-0.5 text-[8px] font-medium opacity-80">score</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{c.name}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                      {c.category}
                    </span>
                    {bo && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${bo.cls}`}>
                        {bo.emoji} {bo.label}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* スタッツ（折り返しグリッド・横スクロールなし） */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <Stat label="市場規模" value={c.marketSize} />
                <Stat label="検索需要" value={levelMeta(c.demand)?.label} cls={levelMeta(c.demand)?.cls} />
                <Stat label="競合強度" value={comp?.label} cls={comp?.cls} />
                <Stat label="期待収益" value={c.expectedRevenue} />
                <Stat label="開発難易度" value={levelMeta(c.devDifficulty, true)?.label} cls={levelMeta(c.devDifficulty, true)?.cls} />
                <Stat label="海外展開" value={levelMeta(c.overseas)?.label} cls={levelMeta(c.overseas)?.cls} />
              </div>

              {c.notes && <p className="mt-2 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{c.notes}</p>}

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span
                  className={`rounded-full px-1.5 py-0.5 font-medium ${
                    (c.sourceRefs?.length ?? 0) > 0
                      ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                  }`}
                >
                  {(c.sourceRefs?.length ?? 0) > 0 ? `📎 調査元 ${c.sourceRefs!.length}` : '出典なし'}
                </span>
                <span className="text-gray-400">発見 {(c.discoveredAt ?? '').slice(0, 10)}</span>
                {c.lastResearchedAt && <span className="text-gray-400">最終調査 {c.lastResearchedAt.slice(0, 10)}</span>}
                {c.ingestedAt && <span className="text-gray-400">取込 {c.ingestedAt.slice(0, 10)}</span>}
                {c.nextAction && <span className="text-blue-500 dark:text-blue-400">次: {c.nextAction}</span>}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
