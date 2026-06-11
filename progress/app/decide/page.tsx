export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxItemActions from '@/components/newux/InboxActions'
import AiCheckButton from '@/components/newux/AiCheckButton'
import { buildInbox } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'

// Inbox = あなたが処理するものだけが入る箱。処理すると消える。
// 承認 / 目標との紐付け / 公開判断 / おすすめ次作業の承認 をここに統合。

export default async function InboxPage() {
  const [items, metrics] = await Promise.all([buildInbox(), computeFactoryMetrics()])

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide title="Inbox" guide="ここで承認や判断を行います。処理した項目は自動的に消えます。" />

      <AiCheckButton notReviewedCount={metrics.notReviewedCount} />

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">今日の判断 {items.length}件</h2>
        {items.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            🎉 すべて処理済みです。判断が必要になるとここに表示されます。
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-[11px] font-semibold text-rose-500">{item.kindLabel}</p>
                <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.reason}</p>
                <InboxItemActions item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
