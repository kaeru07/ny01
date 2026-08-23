'use client'

import { useMemo, useState } from 'react'

import {
  BURDEN_LABEL,
  DEVELOPER_SCALE_LABEL,
  HIT_TYPE_LABEL,
  MONETIZATION_LABEL,
  SORT_LABEL,
  VERDICT_LABEL,
  filterRows,
  sortRows,
  type MarketFilter,
  type MarketRow,
  type MarketSortKey,
} from '@/lib/app-market-research-view'

interface Props {
  rows: MarketRow[]
  updatedAt: string
}

const SORT_KEYS: MarketSortKey[] = ['value', 'surging', 'sustained', 'reproducibility', 'rank', 'ratingDelta', 'lastChecked']

function fmt(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('ja-JP') : '—'
}

/** 差分の表示。順位は上昇がプラス、件数は増加がプラス。 */
function Delta({ value, unit = '', invertColor = false }: { value: number | null; unit?: string; invertColor?: boolean }) {
  if (value === null || value === 0) return null
  const up = invertColor ? value < 0 : value > 0
  return (
    <span className={`ml-1 text-[10px] font-black ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {value > 0 ? '+' : ''}{value.toLocaleString('ja-JP')}{unit}
    </span>
  )
}

function Stars({ value }: { value: number | null }) {
  if (!value) return <span className="text-gray-400">—</span>
  return <span className="whitespace-nowrap text-amber-500" aria-label={`再現性 ${value} / 5`}>{'★'.repeat(value)}<span className="text-gray-300 dark:text-gray-600">{'★'.repeat(5 - value)}</span></span>
}

export default function MarketResearchClient({ rows, updatedAt }: Props) {
  const [sort, setSort] = useState<MarketSortKey>('value')
  const [filter, setFilter] = useState<MarketFilter>({})
  const [open, setOpen] = useState<string | null>(null)

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.app.category).filter((value): value is string => Boolean(value)))).sort(),
    [rows],
  )
  const shown = useMemo(() => sortRows(filterRows(rows, filter), sort), [rows, filter, sort])

  function toggle<K extends keyof MarketFilter>(key: K, value: MarketFilter[K]) {
    setFilter((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }))
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[11px] font-bold ${active
      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-200'
      : 'border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300'}`

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">ヒット型</span>
        {(['surging', 'sustained', 'both'] as const).map((key) => (
          <button key={key} type="button" className={chip(filter.hitType === key)} onClick={() => toggle('hitType', key)}>
            {HIT_TYPE_LABEL[key]}
          </button>
        ))}
        <span className="ml-2 text-[11px] font-black text-gray-500 dark:text-gray-400">開発規模</span>
        {(['individual', 'small_company', 'unknown'] as const).map((key) => (
          <button key={key} type="button" className={chip(filter.developerScale === key)} onClick={() => toggle('developerScale', key)}>
            {DEVELOPER_SCALE_LABEL[key]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">収益</span>
        {(['ads', 'iap', 'subscription', 'mixed'] as const).map((key) => (
          <button key={key} type="button" className={chip(filter.monetization === key)} onClick={() => toggle('monetization', key)}>
            {MONETIZATION_LABEL[key]}
          </button>
        ))}
        <span className="ml-2 text-[11px] font-black text-gray-500 dark:text-gray-400">再現性</span>
        {[5, 4, 3].map((value) => (
          <button key={value} type="button" className={chip(filter.minReproducibility === value)} onClick={() => toggle('minReproducibility', value)}>
            ★{value}以上
          </button>
        ))}
        {categories.length > 0 && (
          <>
            <span className="ml-2 text-[11px] font-black text-gray-500 dark:text-gray-400">カテゴリ</span>
            {categories.map((category) => (
              <button key={category} type="button" className={chip(filter.category === category)} onClick={() => toggle('category', category)}>
                {category}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-2 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-gray-500 dark:text-gray-400">並び替え</span>
          {SORT_KEYS.map((key) => (
            <button key={key} type="button" className={chip(sort === key)} onClick={() => setSort(key)}>
              {SORT_LABEL[key]}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
          {shown.length} / {rows.length} 件{updatedAt ? ` ・ 最終調査 ${updatedAt.slice(0, 16).replace('T', ' ')}` : ''}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
          該当するアプリがありません。自動実行のたびに3本前後ずつ調査結果が積み上がります。
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full min-w-[860px] border-collapse bg-white text-left text-xs dark:bg-gray-950">
            <thead>
              <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="px-3 py-2 font-black">アプリ</th>
                <th className="px-3 py-2 font-black">開発規模</th>
                <th className="px-3 py-2 font-black">ヒット型</th>
                <th className="px-3 py-2 font-black">現在順位</th>
                <th className="px-3 py-2 font-black">30日推移</th>
                <th className="px-3 py-2 font-black">評価数・増加</th>
                <th className="px-3 py-2 font-black">Android DL</th>
                <th className="px-3 py-2 font-black">収益</th>
                <th className="px-3 py-2 font-black">再現性</th>
                <th className="px-3 py-2 font-black">判定</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const isOpen = open === row.app.id
                return (
                  <>
                    <tr
                      key={row.app.id}
                      className="cursor-pointer border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-900 dark:hover:bg-gray-900"
                      onClick={() => setOpen(isOpen ? null : row.app.id)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-0.5">
                          {row.app.appStoreUrl ? (
                            <a
                              href={row.app.appStoreUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="font-black text-blue-700 underline dark:text-blue-300"
                            >
                              {row.app.appName}
                            </a>
                          ) : (
                            <span className="font-black text-gray-900 dark:text-gray-100">{row.app.appName}</span>
                          )}
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">{row.app.developer}</span>
                          {row.app.googlePlayUrl && (
                            <a
                              href={row.app.googlePlayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              className="text-[10px] font-bold text-green-700 underline dark:text-green-300"
                            >
                              Google Play
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-bold">{DEVELOPER_SCALE_LABEL[row.app.developerScale]}</td>
                      <td className="px-3 py-2 font-bold">{row.latest?.hitType ? HIT_TYPE_LABEL[row.latest.hitType] : '—'}</td>
                      <td className="px-3 py-2 font-mono font-bold">
                        {row.latest?.currentCategoryRank ? `${row.latest.currentCategoryRank}位` : '—'}
                        <Delta value={row.delta.categoryRank} unit="" />
                      </td>
                      <td className="px-3 py-2 text-[11px]">{row.latest?.rankTrend30d ?? '—'}</td>
                      <td className="px-3 py-2 font-mono">
                        {fmt(row.latest?.ratingCount)}
                        <Delta value={row.delta.ratingCount} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {row.latest?.googlePlayDownloads ?? (row.app.androidAvailable === false ? 'なし' : '—')}
                        {row.delta.downloadsChanged && <span className="ml-1 text-[10px] font-black text-green-600 dark:text-green-400">↑</span>}
                      </td>
                      <td className="px-3 py-2">{row.latest ? MONETIZATION_LABEL[row.latest.monetization] : '—'}</td>
                      <td className="px-3 py-2"><Stars value={row.latest?.reproducibility ?? null} /></td>
                      <td className="px-3 py-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${row.verdict === 'adopt'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
                          : row.verdict === 'reference'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                          {VERDICT_LABEL[row.verdict]}
                        </span>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr key={`${row.app.id}-detail`} className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                        <td colSpan={10} className="px-3 py-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-2">
                              <Field label="なぜ伸びたか" value={row.app.whyGrowing} />
                              <Field label="差別化案" value={row.app.differentiation} />
                              <Field label="継続ヒットの根拠" value={row.latest?.longTermHitEvidence ?? null} />
                              <Field label="直近アップデート" value={row.latest?.updateNote ?? null} />
                              <Field label="判定理由" value={row.verdictReason} />
                            </div>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 text-[11px] font-bold text-gray-600 dark:text-gray-300">
                                <span>サーバー負荷: {BURDEN_LABEL[row.app.serverBurden]}</span>
                                <span>運用負荷: {BURDEN_LABEL[row.app.operationBurden]}</span>
                                <span>コンテンツ負荷: {BURDEN_LABEL[row.app.contentBurden]}</span>
                              </div>
                              <Field label="版権・IP" value={row.app.ipRequirement} />
                              <Field label="リリース" value={[row.app.releaseDate, row.app.ageSinceRelease].filter(Boolean).join(' / ') || null} />
                              <Field label="総合順位" value={row.latest?.currentOverallRank ? `${row.latest.currentOverallRank}位` : null} />
                              <Field label="レビュー件数" value={row.latest?.reviewCount !== null && row.latest?.reviewCount !== undefined ? `${fmt(row.latest.reviewCount)}件` : null} />
                              <Field label="Google Play 評価件数" value={row.latest?.googlePlayRatingCount ? `${fmt(row.latest.googlePlayRatingCount)}件` : null} />
                            </div>
                          </div>

                          {row.previous && (
                            <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-[11px] font-bold text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                              前回（{row.previous.checkedAt.slice(0, 10)}）との差分：
                              カテゴリ順位 {row.previous.currentCategoryRank ?? '—'} → {row.latest?.currentCategoryRank ?? '—'} ／
                              評価件数 {fmt(row.previous.ratingCount)} → {fmt(row.latest?.ratingCount)} ／
                              Google Play DL {row.previous.googlePlayDownloads ?? '—'} → {row.latest?.googlePlayDownloads ?? '—'}
                            </div>
                          )}

                          <div className="mt-3">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">調査履歴（{row.snapshotCount}回）</p>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[520px] border-collapse text-[11px]">
                                <thead>
                                  <tr className="text-gray-500 dark:text-gray-400">
                                    <th className="py-1 pr-3 text-left font-bold">調査日時</th>
                                    <th className="py-1 pr-3 text-left font-bold">カテゴリ順位</th>
                                    <th className="py-1 pr-3 text-left font-bold">評価件数</th>
                                    <th className="py-1 pr-3 text-left font-bold">Play DL</th>
                                    <th className="py-1 pr-3 text-left font-bold">再現性</th>
                                  </tr>
                                </thead>
                                <tbody className="font-mono">
                                  {[...row.app.snapshots].reverse().map((snapshot) => (
                                    <tr key={snapshot.checkedAt} className="border-t border-gray-200 dark:border-gray-800">
                                      <td className="py-1 pr-3">{snapshot.checkedAt.slice(0, 16).replace('T', ' ')}</td>
                                      <td className="py-1 pr-3">{snapshot.currentCategoryRank ?? '—'}</td>
                                      <td className="py-1 pr-3">{fmt(snapshot.ratingCount)}</td>
                                      <td className="py-1 pr-3">{snapshot.googlePlayDownloads ?? '—'}</td>
                                      <td className="py-1 pr-3">{snapshot.reproducibility ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {(row.latest?.sourceUrls.length ?? 0) > 0 && (
                            <div className="mt-3">
                              <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">情報源</p>
                              <ul className="space-y-0.5">
                                {row.latest?.sourceUrls.map((url) => (
                                  <li key={url}>
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-[11px] text-blue-700 underline dark:text-blue-300">{url}</a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-[12px] font-semibold leading-relaxed text-gray-800 dark:text-gray-100">{value ?? '確認できない'}</p>
    </div>
  )
}
