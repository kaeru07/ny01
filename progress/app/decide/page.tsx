export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxTabs from '@/components/newux/InboxTabs'
import { buildInbox } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'
import { getAutoQueueView } from '@/lib/auto-queue'

// Inbox = 社長向け意思決定アプリ（タブ構成）。
// タブ: 今日の判断（工場停止要因のみ・最大3件） / レビュー（放置可） / Epic候補（放置可） / AI保留（件数のみ）
// 社長は「今日の判断」タブだけ処理すれば工場は止まらない。

export default async function TodayDecisionsPage() {
  const [inbox, metrics, autoQueue] = await Promise.all([buildInbox(), computeFactoryMetrics(), getAutoQueueView()])

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <PageGuide
        title="今日の判断"
        guide="「今日の判断」タブだけ処理すれば工場は止まりません。ほかのタブは時間があるときで大丈夫です。"
      />
      <InboxTabs inbox={inbox} notReviewedCount={metrics.notReviewedCount} autoQueue={autoQueue} />
    </div>
  )
}
