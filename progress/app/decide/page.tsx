export const dynamic = 'force-dynamic'

import PageGuide from '@/components/newux/PageGuide'
import InboxCardItem from '@/components/newux/InboxActions'
import AiCheckButton from '@/components/newux/AiCheckButton'
import { buildInbox } from '@/lib/command-center'
import { computeFactoryMetrics } from '@/lib/factory-metrics'

// Inbox = 社長向け意思決定アプリ（4セクション構成・2026-06-11 運用方針変更）。
// ① 今日の判断: 工場停止要因のみ（危険判断 / 方針選択 / 人間作業）。最大3件・約3分
// ② レビュー: 検収（公開確認・実装確認・成果確認）。放置しても工場は止まらない
// ③ Epic候補: 実行許可（改善案・次Epic・収益化候補）。放置可能
// ④ AI保留: 件数だけ表示（AIレビュー・候補整理など。カードは出さない）

const SECTION_DISPLAY_LIMIT = 5

export default async function TodayDecisionsPage() {
  const [inbox, metrics] = await Promise.all([buildInbox(), computeFactoryMetrics()])

  return (
    <div className="space-y-6 px-4 pb-6 pt-6">
      <PageGuide
        title="今日の判断"
        guide="①だけ処理すれば工場は止まりません。②③は時間があるときで大丈夫です。"
      />

      {/* ① 今日の判断（工場停止要因のみ・最大3件） */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">① 今日の判断（工場が止まる原因）</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            残り{inbox.decisions.length}件 約{inbox.estimatedMinutes}分
          </span>
        </div>
        {inbox.decisions.length === 0 ? (
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center text-sm font-semibold text-green-700 dark:border-green-900/40 dark:bg-green-900/15 dark:text-green-300">
            🎉 工場を止める判断はありません。AI工場は稼働を続けます。
          </p>
        ) : (
          <ul className="space-y-3">
            {inbox.decisions.map((card) => (
              <InboxCardItem key={card.id} card={card} />
            ))}
          </ul>
        )}
        {inbox.decisionTotal > inbox.decisions.length && (
          <p className="mt-2 text-[11px] text-gray-400">ほか{inbox.decisionTotal - inbox.decisions.length}件は明日以降に順番に出ます</p>
        )}
      </section>

      {/* ② レビュー（放置しても工場は止まらない） */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">② レビュー（{inbox.reviewTotal}件）</h2>
          <span className="text-[11px] text-gray-400">放置しても工場は止まりません</span>
        </div>
        {inbox.reviewTotal === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
            レビュー待ちはありません。
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {inbox.reviews.slice(0, SECTION_DISPLAY_LIMIT).map((card) => (
                <InboxCardItem key={card.id} card={card} />
              ))}
            </ul>
            {inbox.reviewTotal > SECTION_DISPLAY_LIMIT && (
              <p className="mt-2 text-[11px] text-gray-400">ほか{inbox.reviewTotal - SECTION_DISPLAY_LIMIT}件。処理すると次が出ます</p>
            )}
          </>
        )}
        <div className="mt-3">
          <AiCheckButton notReviewedCount={metrics.notReviewedCount} />
        </div>
      </section>

      {/* ③ Epic候補（放置可能） */}
      <section>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">③ Epic候補（{inbox.candidateTotal}件）</h2>
          <span className="text-[11px] text-gray-400">放置可能。気が向いたときに</span>
        </div>
        {inbox.candidateTotal === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
            いま提案できる候補はありません。
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {inbox.candidates.slice(0, SECTION_DISPLAY_LIMIT).map((card) => (
                <InboxCardItem key={card.id} card={card} />
              ))}
            </ul>
            {inbox.candidateTotal > SECTION_DISPLAY_LIMIT && (
              <p className="mt-2 text-[11px] text-gray-400">ほか{inbox.candidateTotal - SECTION_DISPLAY_LIMIT}件。処理すると次が出ます</p>
            )}
          </>
        )}
      </section>

      {/* ④ AI保留（件数のみ） */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-center dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[11px] text-gray-400">④ AI保留</p>
        <p className="mt-0.5 text-xl font-bold text-gray-400 dark:text-gray-500">{inbox.aiHoldCount}件</p>
        <p className="text-[11px] text-gray-400">AIが整理中です（あなたの判断は不要）</p>
      </section>
    </div>
  )
}
