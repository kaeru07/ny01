export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import AutoExecReport from '@/components/operations/AutoExecReport'
import { buildReportDigest, type ReportDigest } from '@/lib/report-digest'

function one(searchParams: Record<string, string | string[] | undefined> | undefined, key: string): string {
  const value = searchParams?.[key]
  return typeof value === 'string' ? value : ''
}

export default async function AutoExecutionReportPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const digest = await buildReportDigest()

  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <PageGuide
        title="レポート"
        guide="AI工場の自動実行を1件ずつ深く確認する専用ページです。検索・期間・状態・実行者・対象アプリ・レビュー状態で絞り込めます。"
      />
      <DigestCard digest={digest} />
      <details className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <summary className="cursor-pointer select-none text-sm font-bold text-gray-800 hover:text-gray-950 dark:text-gray-100 dark:hover:text-white">
          1件ずつ詳しく見る（従来表示）
        </summary>
        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <AutoExecReport
            standalone
            basePath="/report"
            q={one(searchParams, 'q')}
            range={one(searchParams, 'range')}
            status={one(searchParams, 'status')}
            executor={one(searchParams, 'executor')}
            app={one(searchParams, 'app')}
            review={one(searchParams, 'review')}
            limit={one(searchParams, 'limit')}
            group={one(searchParams, 'group')}
          />
        </div>
      </details>
    </div>
  )
}

function DigestCard({ digest }: { digest: ReportDigest }) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm dark:border-emerald-900/40 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-black text-gray-900 dark:text-gray-100">📊 自動実行ダイジェスト（{digest.date || '記録なし'}）</h2>
          <p className="mt-2 text-lg font-black leading-snug text-gray-950 dark:text-white">{digest.headline}</p>
        </div>
      </div>

      {digest.achievements.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-emerald-700 dark:text-emerald-300">✨できるようになったこと</h3>
          <ul className="mt-2 space-y-2">
            {digest.achievements.map((item, index) => (
              <li key={`${item.app}-${index}`} className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm leading-relaxed text-emerald-950 dark:bg-emerald-900/20 dark:text-emerald-100">
                <span className="h-fit shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-emerald-500 dark:text-emerald-950">{item.app}</span>
                <span className="min-w-0 break-words">{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {digest.progressed.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-blue-700 dark:text-blue-300">📈進んだゴール</h3>
          <ul className="mt-2 space-y-1.5">
            {digest.progressed.map((item) => (
              <li key={item.goalTitle} className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:bg-blue-900/20 dark:text-blue-100">
                <span className="font-bold">{item.goalTitle}</span>
                <span className="text-xs text-blue-700 dark:text-blue-300">{item.runCount}件進行</span>
                {item.done && <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-blue-400 dark:text-blue-950">達成🎉</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {digest.problems.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-amber-700 dark:text-amber-300">⚠️問題と対処</h3>
          <ul className="mt-2 space-y-1.5">
            {digest.problems.map((item, index) => (
              <li key={`${item.text}-${index}`} className="rounded-lg bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-950 dark:bg-amber-900/20 dark:text-amber-100">
                <span className="font-bold">{item.text}</span>
                <span className="text-amber-800 dark:text-amber-200">。{item.resolution}。</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {digest.next.length > 0 && (
        <section className="mt-4">
          <h3 className="text-sm font-black text-gray-800 dark:text-gray-100">⏭次にやること</h3>
          <ul className="mt-2 space-y-1.5">
            {digest.next.map((item, index) => (
              <li key={`${item.title}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100">{item.title}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        実行{digest.counts.total}件（完了{digest.counts.completed}・一部{digest.counts.partial}・失敗{digest.counts.failed}・実質作業なし{digest.counts.noop}件は表示省略）
      </p>
    </section>
  )
}
