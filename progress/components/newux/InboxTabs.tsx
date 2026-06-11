'use client'

import { useState } from 'react'
import type { InboxView } from '@/lib/command-center'
import InboxCardItem from './InboxActions'
import AiCheckButton from './AiCheckButton'

// Inbox の4区分（今日の判断 / レビュー / Epic候補 / AI保留）をタブで切り替える。
// 縦積みだとスクロールが長くなるため、社長は「今日の判断」タブだけ見れば終わる構成にする。

const SECTION_DISPLAY_LIMIT = 5

type TabKey = 'decisions' | 'reviews' | 'candidates' | 'aiHold'

interface Props {
  inbox: InboxView
  notReviewedCount: number
}

export default function InboxTabs({ inbox, notReviewedCount }: Props) {
  const [tab, setTab] = useState<TabKey>('decisions')

  const tabs: Array<{ key: TabKey; label: string; count: number; alert: boolean }> = [
    { key: 'decisions', label: '今日の判断', count: inbox.decisions.length, alert: inbox.decisions.length > 0 },
    { key: 'reviews', label: 'レビュー', count: inbox.reviewTotal, alert: false },
    { key: 'candidates', label: 'Epic候補', count: inbox.candidateTotal, alert: false },
    { key: 'aiHold', label: 'AI保留', count: inbox.aiHoldCount, alert: false },
  ]

  return (
    <div>
      {/* タブバー */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-1 py-2 text-center text-[11px] font-semibold leading-tight transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <span className="block">{t.label}</span>
            <span className={`mt-0.5 block text-xs font-bold ${t.alert ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
              {t.count}件
            </span>
          </button>
        ))}
      </div>

      {/* ① 今日の判断（工場停止要因のみ・最大3件） */}
      {tab === 'decisions' && (
        <section className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">工場が止まる原因だけが入ります</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">約{inbox.estimatedMinutes}分</span>
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
      )}

      {/* ② レビュー（放置しても工場は止まらない） */}
      {tab === 'reviews' && (
        <section className="mt-4">
          <p className="mb-2 text-[11px] text-gray-400">放置しても工場は止まりません。時間があるときで大丈夫です。</p>
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
            <AiCheckButton notReviewedCount={notReviewedCount} />
          </div>
        </section>
      )}

      {/* ③ Epic候補（放置可能） */}
      {tab === 'candidates' && (
        <section className="mt-4">
          <p className="mb-2 text-[11px] text-gray-400">放置可能です。気が向いたときに「進める/やめる」を選んでください。</p>
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
      )}

      {/* ④ AI保留（件数のみ） */}
      {tab === 'aiHold' && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-3xl font-bold text-gray-400 dark:text-gray-500">{inbox.aiHoldCount}件</p>
          <p className="mt-1 text-xs text-gray-400">AIが整理中です（あなたの判断は不要）</p>
          <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
            定期実行・重複・内容不足・同じテーマの大量候補をAIが預かっています。必要になれば順番に出てきます。
          </p>
        </section>
      )}
    </div>
  )
}
