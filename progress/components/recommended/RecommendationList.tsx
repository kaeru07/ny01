'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { RecommendedEpic, RecommendationStatus } from '@/types/recommended-epic'
import { RECOMMENDATION_STATUSES } from '@/types/recommended-epic'
import { recStatusMeta, impactMeta } from '@/lib/recommended-epics-ui'

export default function RecommendationList({ recommendations }: { recommendations: RecommendedEpic[] }) {
  const [filter, setFilter] = useState<RecommendationStatus | 'all'>('all')

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of recommendations) m.set(r.status, (m.get(r.status) ?? 0) + 1)
    return m
  }, [recommendations])

  const visible = filter === 'all' ? recommendations : recommendations.filter((r) => r.status === filter)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
        >
          すべて {recommendations.length}
        </button>
        {RECOMMENDATION_STATUSES.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => {
          const meta = recStatusMeta(s)
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === s ? 'ring-2 ring-blue-400 ' + meta.cls : meta.cls}`}
            >
              {meta.label} {counts.get(s)}
            </button>
          )
        })}
      </div>

      {visible.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-400 dark:border-gray-700">
          おすすめがありません。右上の「🔄 抽出実行」で生成します（定例 11:00/23:00/起動時でも生成）。
        </p>
      )}

      <div className="space-y-3">
        {visible.map((r) => {
          const st = recStatusMeta(r.status)
          const im = impactMeta(r.monetizationImpact)
          const elig = r.factoryEligiblePreview
          return (
            <Link
              key={r.id}
              href={`/recommended-epics/${r.id}`}
              className="block rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${im.cls}`}>{im.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                  {r.kind === 'new_epic' ? '新規Epic' : '既存Epic継続'}
                </span>
                {r.priority && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-300">{r.priority}</span>
                )}
              </div>

              <h2 className="mt-2 text-base font-bold text-gray-900 dark:text-gray-100">{r.title}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{r.reason}</p>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                {r.targetApp && <span className="text-gray-400">対象: {r.targetApp}</span>}
                {r.relatedEpicId && <span className="text-gray-400">既存: {r.relatedEpicId}</span>}
                {r.riskFlags.length > 0 && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                    ⚠ {r.riskFlags.join(', ')}
                  </span>
                )}
                {r.duplicate?.duplicate && (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">重複あり</span>
                )}
                {elig && (() => {
                  // 後方互換: classification 未設定の旧データは eligible から推定
                  const managed = elig.factoryManaged ?? elig.eligible
                  const cls = elig.classification ?? (elig.eligible ? 'auto' : 'approval')
                  const label = !managed ? 'Factory対象外' : cls === 'auto' ? 'Factory自動可' : '要承認'
                  const tone = !managed
                    ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    : cls === 'auto'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  return <span className={`rounded-full px-2 py-0.5 font-semibold ${tone}`}>{label}</span>
                })()}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
