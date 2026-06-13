'use client'

import { useState } from 'react'
import type { InboxView } from '@/lib/command-center'
import InboxCardItem from './InboxActions'
import AiCheckButton from './AiCheckButton'
import InboxReviewCopyButton from './InboxReviewCopyButton'

// Inbox の4区分（今日の判断 / レビュー / Epic候補 / AI保留）をタブで切り替える。
// 縦積みだとスクロールが長くなるため、社長は「今日の判断」タブだけ見れば終わる構成にする。

const SECTION_DISPLAY_LIMIT = 5
// レビューが大量でも「隠れている」印象を出さないため、全件を明示ページングで見せる。
const REVIEW_PAGE_SIZE = 50

type TabKey = 'decisions' | 'reviews' | 'candidates' | 'aiHold'
type ReviewFilter = 'unconfirmed' | 'followup' | 'snoozed' | 'reviewed'

interface Props {
  inbox: InboxView
  notReviewedCount: number
}

export default function InboxTabs({ inbox, notReviewedCount }: Props) {
  const [tab, setTab] = useState<TabKey>('decisions')
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('unconfirmed')
  const [reviewPage, setReviewPage] = useState(0)

  // レビュー一覧をフィルタ別に分割（隠さず全件・completedAt降順は server で確定済み）。
  const unconfirmedReviews = inbox.reviews.filter(
    (c) => c.reviewStatus === 'not_reviewed' || c.reviewStatus === 'copied' || c.reviewStatus === 'needs_human',
  )
  const followupReviews = inbox.reviews.filter((c) => c.reviewStatus === 'needs_followup')
  const snoozedReviews = inbox.reviews.filter((c) => c.reviewStatus === 'snoozed')
  const reviewFilters: Array<{ key: ReviewFilter; label: string; count: number; list: typeof inbox.reviews }> = [
    { key: 'unconfirmed', label: '未確認', count: inbox.reviewCounts.unconfirmed, list: unconfirmedReviews },
    { key: 'followup', label: '要修正', count: inbox.reviewCounts.followup, list: followupReviews },
    { key: 'snoozed', label: 'あとで', count: inbox.reviewCounts.snoozed, list: snoozedReviews },
    { key: 'reviewed', label: 'レビュー済み', count: inbox.reviewedTotal, list: inbox.reviewedHistory },
  ]
  const activeFilter = reviewFilters.find((f) => f.key === reviewFilter) ?? reviewFilters[0]
  const totalForFilter = activeFilter.key === 'reviewed' ? inbox.reviewedTotal : activeFilter.list.length
  const pageStart = reviewPage * REVIEW_PAGE_SIZE
  const pageItems = activeFilter.list.slice(pageStart, pageStart + REVIEW_PAGE_SIZE)
  const pageEnd = pageStart + pageItems.length

  function changeReviewFilter(key: ReviewFilter) {
    setReviewFilter(key)
    setReviewPage(0)
  }

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

      {/* ② レビュー（放置しても工場は止まらない・隠さず全件） */}
      {tab === 'reviews' && (
        <section className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">放置しても工場は止まりません。レビュー運用の正本です。最新の完了が上です。</p>
            {inbox.reviewTotal > 0 && <InboxReviewCopyButton all />}
          </div>

          {/* 件数サマリー */}
          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">未確認 {inbox.reviewCounts.unconfirmed}件</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">要修正 {inbox.reviewCounts.followup}件</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">あとで {inbox.reviewCounts.snoozed}件</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">レビュー済み {inbox.reviewedTotal}件</span>
          </div>

          {/* フィルタタブ（未確認 / 要修正 / あとで / レビュー済み） */}
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800/60">
            {reviewFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => changeReviewFilter(f.key)}
                className={`flex-1 rounded-md px-1 py-1.5 text-center text-[11px] font-semibold leading-tight transition-colors ${
                  reviewFilter === f.key
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {f.label}
                <span className="ml-0.5 text-gray-400">{f.count}</span>
              </button>
            ))}
          </div>

          {totalForFilter === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
              {activeFilter.label}はありません。
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-gray-400">
                全{totalForFilter}件中 {pageStart + 1}〜{pageEnd}件を表示
                {activeFilter.key === 'reviewed' && inbox.reviewedTotal > inbox.reviewedHistory.length && (
                  <span>（直近{inbox.reviewedHistory.length}件まで表示）</span>
                )}
              </p>
              <ul className="space-y-3">
                {pageItems.map((card) => (
                  <InboxCardItem key={card.id} card={card} />
                ))}
              </ul>
              {activeFilter.list.length > REVIEW_PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setReviewPage((p) => Math.max(0, p - 1))}
                    disabled={reviewPage === 0}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                  >
                    ← 前の{REVIEW_PAGE_SIZE}件
                  </button>
                  <span className="text-[11px] text-gray-400">
                    {reviewPage + 1} / {Math.ceil(activeFilter.list.length / REVIEW_PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setReviewPage((p) => (pageStart + REVIEW_PAGE_SIZE < activeFilter.list.length ? p + 1 : p))}
                    disabled={pageStart + REVIEW_PAGE_SIZE >= activeFilter.list.length}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                  >
                    次の{REVIEW_PAGE_SIZE}件 →
                  </button>
                </div>
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
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-400 dark:text-gray-500">{inbox.aiHoldCount}件</p>
            <p className="mt-1 text-xs text-gray-400">AIが整理中です（あなたの判断は不要）</p>
          </div>
          {inbox.aiHoldBreakdown.length > 0 && (
            <dl className="mt-4 space-y-2">
              {inbox.aiHoldBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                  <dt className="text-xs font-semibold text-gray-700 dark:text-gray-200">{item.label}</dt>
                  <dd className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.count}件</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            重複候補・定期実行・次作業候補・自動レビュー待ちなどをAIが分類して預かっています。必要になれば順番に今日の判断へ出ます。
          </p>
        </section>
      )}
    </div>
  )
}
