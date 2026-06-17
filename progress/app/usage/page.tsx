export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import { buildUsageSummary } from '@/lib/usage-store'

// 使用状況 = Progress 自身の使われ方を把握するページ。
// どの画面をよく開き、どのボタンをよく押し、最後にいつ使い、どの画面を放置しているかを集計表示する。
// 記録は UsageTracker（layout 常駐）→ /api/usage → usage-log.ndjson。表示専用で実行ロジックには影響しない。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const h2 = 'text-sm font-bold text-gray-900 dark:text-gray-100'
const body = 'text-xs leading-relaxed text-gray-600 dark:text-gray-300'

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relativeFromNow(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const diffMs = Date.now() - t
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}時間前`
  const day = Math.floor(hr / 24)
  return `${day}日前`
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400" style={{ width: `${Math.max(pct, 3)}%` }} />
    </div>
  )
}

export default async function UsagePage() {
  const summary = await buildUsageSummary(7)
  const maxScreenCount = summary.screens[0]?.count ?? 0
  const maxActionCount = summary.topActions[0]?.count ?? 0

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="使用状況"
        guide="Progress 自身の使われ方（よく開く画面・よく押すボタン・最後に使った日時・放置している画面）を直近7日で集計します。記録は自動で、画面の動作には影響しません。"
      />

      {/* サマリー */}
      <section className={card}>
        <h2 className={h2}>サマリー（直近{summary.rangeDays}日）</h2>
        {!summary.hasData ? (
          <p className={`mt-2 ${body}`}>
            まだ記録がありません。画面を開いたりボタンを押したりすると、ここに使用状況が集計されます（数回操作してから再読み込みしてください）。
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{summary.totalPageViews}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">画面表示</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{summary.totalActions}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">ボタン操作</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{fmtDateTime(summary.lastAt)}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">最後に使った</p>
            </div>
          </div>
        )}
      </section>

      {/* 画面別アクセス回数 */}
      <section className={card}>
        <h2 className={h2}>画面別アクセス回数（直近{summary.rangeDays}日）</h2>
        {summary.screens.length === 0 ? (
          <p className={`mt-2 ${body}`}>記録がありません。</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {summary.screens.map((s) => (
              <li key={s.href}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{s.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{s.count}回</span>
                </div>
                <div className="mt-1">
                  <Bar value={s.count} max={maxScreenCount} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* よく使うボタン操作 TOP */}
      <section className={card}>
        <h2 className={h2}>よく使うボタン操作 TOP（直近{summary.rangeDays}日）</h2>
        {summary.topActions.length === 0 ? (
          <p className={`mt-2 ${body}`}>記録がありません。ボタンを押すとここに集計されます。</p>
        ) : (
          <ol className="mt-3 space-y-2.5">
            {summary.topActions.map((a, i) => (
              <li key={`${a.label}-${i}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                    <span className="mr-1.5 text-gray-400">{i + 1}.</span>
                    {a.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">{a.count}回</span>
                </div>
                <div className="mt-1">
                  <Bar value={a.count} max={maxActionCount} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* 画面別 最終使用日時 */}
      <section className={card}>
        <h2 className={h2}>画面別 最終使用日時（全期間）</h2>
        {summary.lastUsedByScreen.length === 0 ? (
          <p className={`mt-2 ${body}`}>記録がありません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {summary.lastUsedByScreen.map((s) => (
              <li key={s.href} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{s.label}</span>
                <span className="shrink-0 text-[11px] text-gray-500 dark:text-gray-400">
                  {fmtDateTime(s.lastAt)}・{relativeFromNow(s.lastAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 放置検知 */}
      <section className={`${card} border-amber-200 dark:border-amber-900/40`}>
        <h2 className={h2}>放置している画面（直近{summary.rangeDays}日 未アクセス）</h2>
        <p className={`mt-1 ${body}`}>登録済みの主要画面のうち、直近{summary.rangeDays}日で1度も開いていない画面です。使っていない＝不要かもしれない画面の見直しに使えます。</p>
        {summary.unusedScreens.length === 0 ? (
          <p className={`mt-2 ${body}`}>放置中の画面はありません（すべて直近{summary.rangeDays}日に使われています）。</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.unusedScreens.map((s) => (
              <span
                key={s.href}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/15 dark:text-amber-300"
              >
                {s.label}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
