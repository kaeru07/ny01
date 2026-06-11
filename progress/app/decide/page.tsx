export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxCardActions from '@/components/newux/InboxActions'
import AiCheckButton from '@/components/newux/AiCheckButton'
import { buildInbox, KIND_CHIP_LABEL } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'

// 今日の判断 = 社長向け意思決定アプリ。
// カードは「何が起きているか（状況）+ 放置するとどうなるか（影響）+ 問いかけ」で構成。
// 今日見せるのは最大3件（約3分）。残りはAI保留としてAIが預かる。
// 内部概念（ExecutionRun / runId / reviewed / suggested 等）は「詳細を見る」の中以外に出さない。

const KIND_CHIP_CLASS: Record<string, string> = {
  problem: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  improve: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  confirm: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  goal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
}

export default async function TodayDecisionsPage() {
  const [inbox, metrics] = await Promise.all([buildInbox(), computeFactoryMetrics()])

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="今日の判断"
        guide="上から順にボタンを押すだけです。残りの管理はAIが行います。"
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
          <p className="text-[11px] text-gray-400">AIが預かり、順番に出します</p>
        </div>
      </div>

      {inbox.today.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
          🎉 今日の判断はすべて終わりました。あとはAIが進めます。
        </p>
      ) : (
        <ul className="space-y-3">
          {inbox.today.map((card) => (
            <li key={card.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_CHIP_CLASS[card.kind]}`}>
                {KIND_CHIP_LABEL[card.kind]}
              </span>
              <p className="mt-2 text-base font-bold leading-relaxed text-gray-900 dark:text-gray-100">{card.headline}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{card.impact}</p>
              {card.question && (
                <p className="mt-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">{card.question}</p>
              )}
              <InboxCardActions card={card} />
            </li>
          ))}
        </ul>
      )}

      <AiCheckButton notReviewedCount={metrics.notReviewedCount} />
    </div>
  )
}
