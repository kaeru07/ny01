'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RadarProject, TopFocus } from '@/lib/radar'
import { statusColor } from '@/lib/radar'

interface Props {
  radar: RadarProject[]
  focus: TopFocus | null
  dates: string[]
}

const REV_LABEL: Record<string, string> = { high: '収益高', medium: '収益中', low: '収益低' }

function StatusPill({ s }: { s: string }) {
  const cls: Record<string, string> = {
    放置: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    レビュー待ち: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    停止: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    進行中: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    着手: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    完了: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${cls[s] ?? cls['着手']}`}>{s}</span>
  )
}

export default function RadarBoard({ radar, focus, dates }: Props) {
  const [sel, setSel] = useState<RadarProject | null>(null)

  const sorted = [...radar].sort((a, b) => {
    const rank: Record<string, number> = { 放置: 5, レビュー待ち: 4, 停止: 3, 進行中: 2, 着手: 1, 完了: 0 }
    const d = (rank[b.status] ?? 0) - (rank[a.status] ?? 0)
    if (d !== 0) return d
    return b.staleDays - a.staleDays
  })

  const todayIdx = dates.length - 1

  return (
    <div className="space-y-5">
      {/* 今やるべき1件 */}
      {focus && (
        <section className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            今やるべき1件
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 leading-snug">
            {focus.name}
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">→ {focus.nextStep}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="px-2 py-0.5 rounded-md bg-white/70 dark:bg-gray-800">
              想定 {focus.estimate}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/70 dark:bg-gray-800">
              理由: {focus.reason}
            </span>
          </div>
        </section>
      )}

      {/* ガント */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
          ガント（直近21日 · バー押下で詳細）
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* 日付ヘッダ */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <div className="sticky left-0 z-10 w-36 flex-shrink-0 bg-gray-50 dark:bg-gray-800/60 px-3 py-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                  案件
                </div>
                <div className="flex flex-1">
                  {dates.map((d, i) => (
                    <div
                      key={d}
                      className={`flex-1 text-center text-[9px] py-2 ${
                        i === todayIdx
                          ? 'text-blue-500 font-bold'
                          : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {d.slice(5)}
                    </div>
                  ))}
                </div>
              </div>

              {/* 行 */}
              {sorted.map((p) => {
                const startIdx = Math.max(
                  0,
                  dates.findIndex((d) => d >= p.updatedAt.slice(0, 10))
                )
                const s = startIdx === -1 ? 0 : startIdx
                const span = Math.max(1, dates.length - s)
                return (
                  <button
                    key={p.id}
                    onClick={() => setSel(p)}
                    className="flex w-full items-center border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors text-left"
                  >
                    <div className="sticky left-0 z-10 w-36 flex-shrink-0 bg-white dark:bg-gray-900 px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {p.revenue === 'high' && <span title="収益高">👑 </span>}
                        {p.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <StatusPill s={p.status} />
                        {p.staleDays >= 7 && (
                          <span className="text-[10px] text-gray-400">{p.staleDays}d</span>
                        )}
                      </div>
                    </div>
                    <div className="relative flex flex-1 h-12 items-center">
                      {dates.map((d, i) => (
                        <div
                          key={d}
                          className={`flex-1 h-full border-r border-gray-50 dark:border-gray-800/50 ${
                            i === todayIdx ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                          }`}
                        />
                      ))}
                      <div
                        className={`absolute h-3 rounded-full ${statusColor(
                          p.status,
                          p.staleDays
                        )} ${p.nextStep && p.status !== '完了' ? 'ring-2 ring-emerald-400/40' : ''}`}
                        style={{
                          left: `${(s / dates.length) * 100}%`,
                          width: `${(span / dates.length) * 100}%`,
                        }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
          <span>🟡 放置7日</span>
          <span>🔴 放置14日/停止</span>
          <span>🔵 レビュー待ち</span>
          <span>🟢 進行中</span>
          <span>👑 収益高</span>
        </div>
      </section>

      {/* モーダル */}
      {sel && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSel(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{sel.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{sel.phase}</p>
              </div>
              <button
                onClick={() => setSel(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <Row k="状態">
                <StatusPill s={sel.status} />
              </Row>
              <Row k="進捗率">{sel.progress}%</Row>
              <Row k="最終更新">{sel.updatedAt.slice(0, 10)}</Row>
              <Row k="放置日数">{sel.staleDays}日</Row>
              <Row k="現在地">{sel.current || '—'}</Row>
              <Row k="次の1手">
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {sel.nextStep}
                </span>
              </Row>
              <Row k="推定時間">{sel.estimate}</Row>
              <Row k="収益インパクト">{REV_LABEL[sel.revenue]}（推定）</Row>
              <Row k="ブロッカー">
                {sel.blockers.length > 0 ? (
                  <ul className="list-disc list-inside text-red-600 dark:text-red-400">
                    {sel.blockers.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                ) : (
                  'なし'
                )}
              </Row>
              <Row k="関連ToDo">
                {sel.relatedTodos.length > 0 ? (
                  <ul className="list-disc list-inside text-gray-600 dark:text-gray-300">
                    {sel.relatedTodos.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                ) : (
                  'なし'
                )}
              </Row>
              <Row k="最新Run">
                {sel.latestRun ? (
                  <span className="text-gray-600 dark:text-gray-300">
                    {sel.latestRun.runId}（{sel.latestRun.runStatus}/{sel.latestRun.reviewStatus}）
                  </span>
                ) : (
                  'なし'
                )}
              </Row>
            </div>

            <div className="flex gap-2 mt-4">
              <Link
                href="/projects"
                className="flex-1 text-center px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                案件一覧
              </Link>
              {sel.url && (
                <a
                  href={sel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 text-center px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium"
                >
                  サイトを開く
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 flex-shrink-0 text-gray-400 dark:text-gray-500">{k}</span>
      <span className="flex-1 text-gray-800 dark:text-gray-100">{children}</span>
    </div>
  )
}
