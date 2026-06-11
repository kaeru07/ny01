export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxCardItem from '@/components/newux/InboxActions'
import AiCheckButton from '@/components/newux/AiCheckButton'
import { buildInbox } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'

// 今日の判断 = 社長向け意思決定アプリ。AI内部処理のビューではない。
// 分類は「人間が何を判断するのか」の6種: 検収 / 実行許可 / 方針選択 / 人間作業 / 危険判断 / AI保留。
// 今日見せるのは優先順（危険判断→検収→方針選択→実行許可→人間作業）の最大3件。
// 人間が答えられないもの（定期実行・内容不足・重複・同テーマ大量候補）はAI保留としてカードを出さない。

export default async function TodayDecisionsPage() {
  const [inbox, metrics] = await Promise.all([buildInbox(), computeFactoryMetrics()])

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="今日の判断"
        guide="上から順にボタンを押すだけです。3分で終わります。残りの管理はAIが行います。"
      />

      {/* 上部サマリー: 残りN件 約N分 / AI保留 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-2 border-blue-200 bg-white p-3 text-center dark:border-blue-900/50 dark:bg-gray-900">
          <p className="text-[11px] text-gray-400">今日の判断</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">残り{inbox.today.length}件</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">約{inbox.estimatedMinutes}分で終わります</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-[11px] text-gray-400">AI保留</p>
          <p className="text-xl font-bold text-gray-400 dark:text-gray-500">{inbox.deferredCount}件</p>
          <p className="text-[11px] text-gray-400">AIが整理中です</p>
        </div>
      </div>

      {inbox.today.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          🎉 今日の判断はすべて終わりました。あとはAIが進めます。
        </p>
      ) : (
        <ul className="space-y-3">
          {inbox.today.map((card) => (
            <InboxCardItem key={card.id} card={card} />
          ))}
        </ul>
      )}

      <AiCheckButton notReviewedCount={metrics.notReviewedCount} />
    </div>
  )
}
