export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxCardActions from '@/components/newux/InboxActions'
import AiCheckButton from '@/components/newux/AiCheckButton'
import { buildInbox } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'

// 今日の判断 = 社長向け承認アプリ。あなたが処理するものだけが入り、処理すると消える。
// カードは「作業結果の確認 / 次の作業 / Goal紐付け」の3種類だけ。
// 内部概念（ExecutionRun / reviewed / suggested 等）は「詳細を見る」の中以外に出さない。

const KIND_CHIP: Record<string, string> = {
  confirm: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  proceed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  goal: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
}

export default async function TodayDecisionsPage() {
  const [cards, metrics] = await Promise.all([buildInbox(), computeFactoryMetrics()])

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide
        title="今日の判断"
        guide="はい・いいえ・あとで を選ぶだけです。残りの管理はAIが行います。3〜5分で終わります。"
      />

      <AiCheckButton notReviewedCount={metrics.notReviewedCount} />

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">残り {cards.length}件</h2>
        {cards.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            🎉 今日の判断はすべて終わりました。あとはAIが進めます。
          </p>
        ) : (
          <ul className="space-y-3">
            {cards.map((card) => (
              <li key={card.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_CHIP[card.kind]}`}>
                  {card.kindLabel}
                </span>
                <p className="mt-2 text-sm font-medium leading-relaxed text-gray-900 dark:text-gray-100">{card.question}</p>
                <InboxCardActions card={card} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
