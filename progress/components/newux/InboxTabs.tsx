'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import FilterBar from '@/components/newux/FilterBar'
import FilterChips from '@/components/newux/FilterChips'
import { buildProgressFilterUrl, parseProgressFilters, updateFilterParam, type ProgressFilterState } from '@/lib/progress-filters'
import type { InboxCard, InboxView } from '@/lib/command-center'
import type { AutoQueueView } from '@/types/auto-queue'
import InboxCardItem from './InboxActions'
import AiCheckButton from './AiCheckButton'
import InboxReviewCopyButton from './InboxReviewCopyButton'

// Inbox の4区分（今日の判断 / レビュー / Epic候補 / AI保留）をタブで切り替える。
// URLクエリを初期状態へ反映し、トップの「Inboxでレビューする」から該当レビューへ直接移動できるようにする。

const SECTION_DISPLAY_LIMIT = 5
// レビューが大量でも「隠れている」印象を出さないため、全件を明示ページングで見せる。
const REVIEW_PAGE_SIZE = 50

type TabKey = 'decisions' | 'goalApproval' | 'reviews' | 'candidates' | 'aiHold'
type ReviewFilter = 'unconfirmed' | 'followup' | 'snoozed' | 'reviewed'
type GoalApprovalSourceFilter = 'auto' | 'other'

interface Props {
  inbox: InboxView
  notReviewedCount: number
  autoQueue: AutoQueueView
}

function tabFromQuery(value: string | null): TabKey {
  if (value === 'review') return 'reviews'
  if (value === 'goalApproval') return 'goalApproval'
  if (value === 'candidates') return 'candidates'
  if (value === 'aiHold') return 'aiHold'
  return 'decisions'
}

function reviewFilterFromQuery(reviewFilter: string | null, filter: string | null, reviewStatus: string | null): ReviewFilter {
  const value = reviewStatus ?? reviewFilter ?? filter
  if (value === 'followup' || value === 'needs_followup') return 'followup'
  if (value === 'snoozed') return 'snoozed'
  if (value === 'reviewed') return 'reviewed'
  return 'unconfirmed'
}

function goalApprovalSourceFromQuery(value: string | null): GoalApprovalSourceFilter {
  return value === 'other' ? 'other' : 'auto'
}

const AUTO_PROPOSAL_SOURCES = new Set(['research', 'app_improvement', 'vision_followup', 'origin_gap', 'factory_idle_improvement'])

function isAutoProposal(card: InboxCard): boolean {
  return AUTO_PROPOSAL_SOURCES.has(card.proposalSource ?? '')
}

function filterForStatus(status?: string): ReviewFilter {
  if (status === 'needs_followup') return 'followup'
  if (status === 'snoozed') return 'snoozed'
  if (status === 'reviewed') return 'reviewed'
  return 'unconfirmed'
}

function isUnconfirmed(card: InboxCard): boolean {
  return card.reviewStatus === 'not_reviewed' || card.reviewStatus === 'copied' || card.reviewStatus === 'needs_human'
}

function goalFiltered(cards: InboxCard[], goalId: string | null): InboxCard[] {
  if (!goalId) return cards
  return cards.filter((card) => (card.goalId ?? 'unassigned') === goalId)
}

function projectFiltered(cards: InboxCard[], projectId: string | null): InboxCard[] {
  if (!projectId) return cards
  return cards.filter((card) => (card.projectId ?? 'unassigned') === projectId)
}

// ゴール（進捗単位）とプロジェクト（targetApp単位）の両方で絞り込む。両方未指定なら素通し。
function scopeFiltered(cards: InboxCard[], goalId: string | null, projectId: string | null): InboxCard[] {
  return projectFiltered(goalFiltered(cards, goalId), projectId)
}

function matchesQuery(card: InboxCard, q?: string): boolean {
  if (!q) return true
  const haystack = [
    card.headline,
    card.question,
    card.detail,
    card.goalTitle,
    card.sourceRunId,
    card.fixPrompt,
    ...(card.rows ?? []).map((row) => `${row.label} ${row.text}`),
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function filterCards(cards: InboxCard[], filters: ProgressFilterState, options: { reviewOnly?: boolean } = {}): InboxCard[] {
  return cards.filter((card) => {
    if (!matchesQuery(card, filters.q)) return false
    if (options.reviewOnly && filters.fixPrompt && !card.fixPrompt) return false
    return true
  })
}

export default function InboxTabs({ inbox, notReviewedCount, autoQueue }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const progressFilters = parseProgressFilters(searchParams)
  const selectedGoalId = searchParams.get('goalId')
  const selectedProjectId = searchParams.get('projectId')
  const focusRunId = searchParams.get('focusRunId')

  const [tab, setTab] = useState<TabKey>(() => tabFromQuery(searchParams.get('tab')))
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(() => reviewFilterFromQuery(searchParams.get('reviewFilter'), searchParams.get('filter'), searchParams.get('reviewStatus')))
  const [reviewPage, setReviewPage] = useState(0)
  const [goalApprovalSource, setGoalApprovalSource] = useState<GoalApprovalSourceFilter>(() => goalApprovalSourceFromQuery(searchParams.get('goalApprovalSource')))

  const allReviewCards = useMemo(() => [...inbox.reviews, ...inbox.reviewedHistory], [inbox.reviews, inbox.reviewedHistory])
  const focusCard = focusRunId ? allReviewCards.find((card) => card.sourceRunId === focusRunId) : undefined

  useEffect(() => {
    setTab(tabFromQuery(searchParams.get('tab')))
    setReviewFilter(reviewFilterFromQuery(searchParams.get('reviewFilter'), searchParams.get('filter'), searchParams.get('reviewStatus')))
    setGoalApprovalSource(goalApprovalSourceFromQuery(searchParams.get('goalApprovalSource')))
    setReviewPage(0)
  }, [searchParams])

  useEffect(() => {
    if (!focusRunId || !focusCard) return
    const nextFilter = filterForStatus(focusCard.reviewStatus)
    setTab('reviews')
    setReviewFilter(nextFilter)
    const sourceList =
      nextFilter === 'reviewed'
        ? scopeFiltered(inbox.reviewedHistory, selectedGoalId, selectedProjectId)
        : scopeFiltered(inbox.reviews, selectedGoalId, selectedProjectId).filter((card) => filterForStatus(card.reviewStatus) === nextFilter)
    const index = sourceList.findIndex((card) => card.sourceRunId === focusRunId)
    setReviewPage(index >= 0 ? Math.floor(index / REVIEW_PAGE_SIZE) : 0)
  }, [focusRunId, focusCard, inbox.reviewedHistory, inbox.reviews, selectedGoalId, selectedProjectId])

  useEffect(() => {
    if (!focusRunId) return
    const timer = window.setTimeout(() => {
      document.getElementById(`review-${focusRunId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 100)
    return () => window.clearTimeout(timer)
  }, [focusRunId, reviewFilter, reviewPage])

  function navigateFilters(patch: Partial<ProgressFilterState>) {
    router.replace(buildProgressFilterUrl('/decide', updateFilterParam(parseProgressFilters(searchParams), patch)), { scroll: false })
  }

  function changeTab(key: TabKey) {
    setTab(key)
    navigateFilters({ tab: key })
  }

  const filteredDecisions = filterCards(scopeFiltered(inbox.decisions, selectedGoalId, selectedProjectId), progressFilters)
  const filteredProposedGoals = filterCards(scopeFiltered(inbox.proposedGoals, selectedGoalId, selectedProjectId), progressFilters)
  const filteredReviews = filterCards(scopeFiltered(inbox.reviews, selectedGoalId, selectedProjectId), progressFilters, { reviewOnly: true })
  const filteredReviewedHistory = filterCards(scopeFiltered(inbox.reviewedHistory, selectedGoalId, selectedProjectId), progressFilters, { reviewOnly: true })
  const filteredCandidates = filterCards(scopeFiltered(inbox.candidates, selectedGoalId, selectedProjectId), progressFilters)
  const selectedGoalSummary = selectedGoalId ? inbox.goalSummaries.find((summary) => summary.goalId === selectedGoalId) : undefined
  const selectedProjectSummary = selectedProjectId ? inbox.projectSummaries.find((summary) => summary.projectId === selectedProjectId) : undefined
  const selectedProjectTitle = selectedProjectId
    ? selectedProjectSummary?.projectTitle ?? (selectedProjectId === 'unassigned' ? '未分類' : selectedProjectId)
    : ''
  const selectedAutoItems = selectedGoalId
    ? [
        ...autoQueue.executable,
        ...autoQueue.waitingUser,
        ...autoQueue.aiHold,
        ...autoQueue.reviewWaiting,
        ...autoQueue.blocked,
        ...autoQueue.manual,
      ].filter((item) => (item.goalId ?? 'unassigned') === selectedGoalId)
    : []
  const selectedGoalTitle = selectedGoalId
    ? selectedGoalSummary?.goalTitle
      ?? selectedAutoItems[0]?.goalTitle
      ?? (selectedGoalId === 'unassigned' ? '未紐づけ' : selectedGoalId)
    : ''

  const unconfirmedReviews = filteredReviews.filter(isUnconfirmed)
  const followupReviews = filteredReviews.filter((c) => c.reviewStatus === 'needs_followup')
  const snoozedReviews = filteredReviews.filter((c) => c.reviewStatus === 'snoozed')
  const reviewFilters: Array<{ key: ReviewFilter; label: string; count: number; list: InboxCard[] }> = [
    { key: 'unconfirmed', label: '未確認', count: unconfirmedReviews.length, list: unconfirmedReviews },
    { key: 'followup', label: '要修正', count: followupReviews.length, list: followupReviews },
    { key: 'snoozed', label: 'あとで', count: snoozedReviews.length, list: snoozedReviews },
    { key: 'reviewed', label: 'レビュー済み', count: filteredReviewedHistory.length, list: filteredReviewedHistory },
  ]
  const activeFilter = reviewFilters.find((f) => f.key === reviewFilter) ?? reviewFilters[0]
  const totalForFilter = activeFilter.list.length
  const pageStart = reviewPage * REVIEW_PAGE_SIZE
  const pageItems = activeFilter.list.slice(pageStart, pageStart + REVIEW_PAGE_SIZE)
  const pageEnd = pageStart + pageItems.length

  function changeReviewFilter(key: ReviewFilter) {
    setReviewFilter(key)
    setReviewPage(0)
    navigateFilters({ tab: 'reviews', reviewStatus: key === 'followup' ? 'needs_followup' : key })
  }

  function changeGoalApprovalSource(key: GoalApprovalSourceFilter) {
    setGoalApprovalSource(key)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'goalApproval')
    params.set('goalApprovalSource', key)
    router.replace(`/decide?${params.toString()}`, { scroll: false })
  }

  const reviewTotal = filteredReviews.length + filteredReviewedHistory.length
  const aiHoldCount = selectedGoalId ? (selectedGoalSummary?.aiHold ?? 0) : inbox.aiHoldCount
  const tabs: Array<{ key: TabKey; label: string; count: number; alert: boolean }> = [
    { key: 'decisions', label: '今日の判断', count: filteredDecisions.length, alert: filteredDecisions.length > 0 },
    { key: 'goalApproval', label: 'ゴール承認', count: filteredProposedGoals.length, alert: filteredProposedGoals.length > 0 },
    { key: 'reviews', label: 'レビュー', count: reviewTotal, alert: false },
    { key: 'candidates', label: 'Epic候補', count: filteredCandidates.length, alert: false },
    { key: 'aiHold', label: 'AI保留', count: aiHoldCount, alert: false },
  ]

  const tabCounts = {
    decisions: filteredDecisions.length,
    goalApproval: filteredProposedGoals.length,
    reviews: reviewTotal,
    candidates: filteredCandidates.length,
    aiHold: aiHoldCount,
  }
  const executableCount = selectedGoalId ? selectedAutoItems.filter((item) => item.status === 'executable').length : autoQueue.counts.executable
  const blockedCount = selectedGoalId ? selectedAutoItems.filter((item) => item.status === 'blocked').length : autoQueue.counts.blocked

  const EmptyGuidance = ({ currentLabel }: { currentLabel: string }) => {
    if (!selectedGoalId) return null
    const alternatives = tabs.filter((item) => item.key !== tab && item.count > 0)
    if (alternatives.length === 0) return null
    return (
      <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/15 dark:text-blue-200">
        <p className="font-semibold">{currentLabel}はありません。ただしこのゴールには別の項目があります。</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {alternatives.map((item) => (
            <button
              key={item.key}
              onClick={() => changeTab(item.key)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              {item.label}を開く（{item.count}件）
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {selectedGoalId && (
        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/50 dark:bg-blue-900/15">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Goalで絞り込み中</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900 dark:text-gray-100">{selectedGoalTitle}</p>
            </div>
            <Link href="/decide" className="rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-900 dark:text-blue-200">
              全体に戻る
            </Link>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-blue-800 dark:text-blue-200">
            <span>今日の判断 {tabCounts.decisions}</span>
            <span>レビュー {tabCounts.reviews}</span>
            <span>要修正 {selectedGoalSummary?.followup ?? followupReviews.length}</span>
            <span>あとで {selectedGoalSummary?.snoozed ?? snoozedReviews.length}</span>
            <span>AI保留 {tabCounts.aiHold}</span>
            <span>Epic候補 {tabCounts.candidates}</span>
            <span>実行可能 {executableCount}</span>
            <span>ブロック {blockedCount}</span>
          </div>
        </div>
      )}

      <div className="mb-3 space-y-2">
        <FilterBar
          basePath="/decide"
          filters={progressFilters}
          quickFilters={[
            { key: 'today', label: '今日の判断', patch: { tab: 'decisions' }, active: (progressFilters.tab ?? 'decisions') === 'decisions' },
            { key: 'goalApproval', label: 'ゴール承認', patch: { tab: 'goalApproval' }, active: progressFilters.tab === 'goalApproval' },
            { key: 'review', label: 'レビュー', patch: { tab: 'reviews' }, active: progressFilters.tab === 'reviews' },
            { key: 'followup', label: '要修正', patch: { tab: 'reviews', reviewStatus: 'needs_followup' }, active: progressFilters.tab === 'reviews' && progressFilters.reviewStatus === 'needs_followup' },
            { key: 'fixPrompt', label: 'fixPromptあり', patch: { tab: 'reviews', fixPrompt: true }, active: progressFilters.fixPrompt === true },
            { key: 'candidates', label: 'Epic候補', patch: { tab: 'candidates' }, active: progressFilters.tab === 'candidates' },
            { key: 'aiHold', label: 'AI保留', patch: { tab: 'aiHold' }, active: progressFilters.tab === 'aiHold' },
          ]}
          selectFilters={[
            { key: 'goalId', label: 'Goal', placeholder: 'すべてのGoal', options: inbox.goalSummaries.map((summary) => ({ value: summary.goalId, label: summary.goalTitle })) },
          ]}
          showSearch
        />
        <FilterChips
          clearHref="/decide"
          chips={[
            { key: 'goalId', label: `Goal: ${selectedGoalTitle || selectedGoalId}`, active: Boolean(selectedGoalId), href: buildProgressFilterUrl('/decide', updateFilterParam(progressFilters, { goalId: undefined })) },
            { key: 'q', label: `検索: ${progressFilters.q}`, active: Boolean(progressFilters.q), href: buildProgressFilterUrl('/decide', updateFilterParam(progressFilters, { q: undefined })) },
            { key: 'fixPrompt', label: 'fixPromptあり', active: progressFilters.fixPrompt === true, href: buildProgressFilterUrl('/decide', updateFilterParam(progressFilters, { fixPrompt: undefined })) },
          ]}
        />
      </div>

      {/* タブバー */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => changeTab(t.key)}
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
      {tab === 'goalApproval' && (() => {
        const autoGoals = filteredProposedGoals.filter(isAutoProposal)
        const otherGoals = filteredProposedGoals.filter((card) => !isAutoProposal(card))
        const sourceTabs: Array<{ key: GoalApprovalSourceFilter; label: string; count: number }> = [
          { key: 'auto', label: '自動実行で追加', count: autoGoals.length },
          { key: 'other', label: 'それ以外', count: otherGoals.length },
        ]
        const shown = goalApprovalSource === 'other' ? otherGoals : autoGoals
        const projectTitleById = new Map(inbox.projectSummaries.map((summary) => [summary.projectId, summary.projectTitle]))
        const groupedShown = Array.from(
          shown.reduce((map, card) => {
            const projectId = card.projectId ?? 'unassigned'
            const group = map.get(projectId)
            if (group) group.push(card)
            else map.set(projectId, [card])
            return map
          }, new Map<string, InboxCard[]>()),
        )
          .map(([projectId, cards]) => ({
            projectId,
            title:
              projectId === 'unassigned'
                ? '未分類'
                : projectTitleById.get(projectId) ?? cards.find((card) => card.projectTitle)?.projectTitle ?? projectId,
            cards,
          }))
          .sort((a, b) => {
            if (a.projectId === 'unassigned') return 1
            if (b.projectId === 'unassigned') return -1
            return b.cards.length - a.cards.length || a.title.localeCompare(b.title, 'ja')
          })
        return (
          <section className="mt-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">🎯 ゴール承認（自動実行が提案した目標）</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">{filteredProposedGoals.length}件</span>
            </div>
            <p className="mb-3 text-[11px] text-gray-500 dark:text-gray-400">承認すると次回以降の自動実行でその目標を達成まで進めます。やめると候補から外します。</p>
            {/* 提案元 サブタブ */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {sourceTabs.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => changeGoalApprovalSource(c.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${goalApprovalSource === c.key ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}
                >
                  {c.label} {c.count}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <p className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-400">
                {filteredProposedGoals.length === 0
                  ? '承認待ちのゴール候補はありません。自動実行（11/14/16/23時）のたびに候補が追加されます。'
                  : 'この分類の承認待ち候補はありません。'}
              </p>
            ) : (
              <div className="space-y-3">
                {groupedShown.map((group) => (
                  <details
                    key={group.projectId}
                    open
                    className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                  >
                    <summary className="min-h-12 cursor-pointer list-none px-3 py-2.5 marker:hidden">
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 text-sm font-bold text-gray-900 dark:text-gray-100">{group.title}</span>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          承認待ち {group.cards.length}件
                        </span>
                      </span>
                    </summary>
                    <ul className="space-y-3 border-t border-gray-100 p-3 dark:border-gray-800">
                      {group.cards.map((card) => (
                        <InboxCardItem key={card.id} card={card} />
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            )}
          </section>
        )
      })()}

      {tab === 'decisions' && (
        <>
        <section className="mt-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">工場が止まる原因だけが入ります</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">約{inbox.estimatedMinutes}分</span>
          </div>
          {filteredDecisions.length === 0 ? (
            <>
              <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center text-sm font-semibold text-green-700 dark:border-green-900/40 dark:bg-green-900/15 dark:text-green-300">
                {progressFilters.q ? '条件に一致する今日の判断はありません。' : '工場を止める判断はありません。AI工場は稼働を続けます。'}
              </p>
              <EmptyGuidance currentLabel="今日の判断" />
              {(progressFilters.q || progressFilters.goalId) && (
                <div className="mt-2 text-center">
                  <Link href="/decide" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">条件をクリア</Link>
                </div>
              )}
            </>
          ) : (
            <ul className="space-y-3">
              {filteredDecisions.map((card) => (
                <InboxCardItem key={card.id} card={card} />
              ))}
            </ul>
          )}
          {!selectedGoalId && inbox.decisionTotal > inbox.decisions.length && (
            <p className="mt-2 text-[11px] text-gray-400">ほか{inbox.decisionTotal - inbox.decisions.length}件は明日以降に順番に出ます</p>
          )}
        </section>
        {scopeFiltered(inbox.autoRuns, selectedGoalId, selectedProjectId).length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">🤖 自動実行の履歴（最近AIが自動で動いた作業）</h2>
              <span className="text-xs text-gray-500 dark:text-gray-400">直近{scopeFiltered(inbox.autoRuns, selectedGoalId, selectedProjectId).length}件</span>
            </div>
            <ul className="space-y-3">
              {scopeFiltered(inbox.autoRuns, selectedGoalId, selectedProjectId).map((card) => (
                <InboxCardItem key={card.id} card={card} />
              ))}
            </ul>
          </section>
        )}
        </>
      )}

      {/* ② レビュー（放置しても工場は止まらない・隠さず全件） */}
      {tab === 'reviews' && (
        <section className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">放置しても工場は止まりません。レビュー運用の正本です。最新の完了が上です。</p>
            {reviewTotal > 0 && <InboxReviewCopyButton all />}
          </div>

          {/* 件数サマリー */}
          <div className="mb-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">未確認 {unconfirmedReviews.length}件</span>
            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">要修正 {followupReviews.length}件</span>
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600 dark:bg-gray-700 dark:text-gray-300">あとで {snoozedReviews.length}件</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">レビュー済み {filteredReviewedHistory.length}件</span>
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
            <>
              <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                {activeFilter.label}はありません。
              </p>
              <EmptyGuidance currentLabel={activeFilter.label} />
              {(progressFilters.q || progressFilters.goalId || progressFilters.fixPrompt) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link href="/decide?tab=review" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    レビュー条件をクリア
                  </Link>
                  {selectedGoalId && (
                    <Link href={buildProgressFilterUrl('/decide', updateFilterParam(progressFilters, { goalId: undefined }))} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                      Goal解除
                    </Link>
                  )}
                </div>
              )}
              {reviewFilters.some((f) => f.key !== reviewFilter && f.count > 0) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {reviewFilters.filter((f) => f.key !== reviewFilter && f.count > 0).map((f) => (
                    <button
                      key={f.key}
                      onClick={() => changeReviewFilter(f.key)}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                    >
                      {f.label}を開く（{f.count}件）
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-gray-400">
                全{totalForFilter}件中 {pageStart + 1}〜{pageEnd}件を表示
                {activeFilter.key === 'reviewed' && !selectedGoalId && inbox.reviewedTotal > inbox.reviewedHistory.length && (
                  <span>（直近{inbox.reviewedHistory.length}件まで表示）</span>
                )}
              </p>
              <ul className="space-y-3">
                {pageItems.map((card) => (
                  <InboxCardItem
                    key={card.id}
                    card={card}
                    highlight={Boolean(focusRunId && card.sourceRunId === focusRunId)}
                    focusNotice={Boolean(focusRunId && card.sourceRunId === focusRunId)}
                  />
                ))}
              </ul>
              {activeFilter.list.length > REVIEW_PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setReviewPage((p) => Math.max(0, p - 1))}
                    disabled={reviewPage === 0}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                  >
                    前の{REVIEW_PAGE_SIZE}件
                  </button>
                  <span className="text-[11px] text-gray-400">
                    {reviewPage + 1} / {Math.ceil(activeFilter.list.length / REVIEW_PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setReviewPage((p) => (pageStart + REVIEW_PAGE_SIZE < activeFilter.list.length ? p + 1 : p))}
                    disabled={pageStart + REVIEW_PAGE_SIZE >= activeFilter.list.length}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200"
                  >
                    次の{REVIEW_PAGE_SIZE}件
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
          {filteredCandidates.length === 0 ? (
            <>
              <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                いま提案できる候補はありません。
              </p>
              <EmptyGuidance currentLabel="Epic候補" />
            </>
          ) : (
            <>
              <ul className="space-y-3">
                {filteredCandidates.slice(0, SECTION_DISPLAY_LIMIT).map((card) => (
                  <InboxCardItem key={card.id} card={card} />
                ))}
              </ul>
              {filteredCandidates.length > SECTION_DISPLAY_LIMIT && (
                <p className="mt-2 text-[11px] text-gray-400">ほか{filteredCandidates.length - SECTION_DISPLAY_LIMIT}件。処理すると次が出ます</p>
              )}
            </>
          )}
        </section>
      )}

      {/* ④ AI保留（件数のみ） */}
      {tab === 'aiHold' && (
        <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-400 dark:text-gray-500">{aiHoldCount}件</p>
            <p className="mt-1 text-xs text-gray-400">AIが整理中です（あなたの判断は不要）</p>
          </div>
          {!selectedGoalId && inbox.aiHoldBreakdown.length > 0 && (
            <dl className="mt-4 space-y-2">
              {inbox.aiHoldBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
                  <dt className="text-xs font-semibold text-gray-700 dark:text-gray-200">{item.label}</dt>
                  <dd className="text-sm font-bold text-gray-900 dark:text-gray-100">{item.count}件</dd>
                </div>
              ))}
            </dl>
          )}
          {aiHoldCount === 0 && <EmptyGuidance currentLabel="AI保留" />}
          <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
            重複候補・定期実行・次作業候補・自動レビュー待ちなどをAIが分類して預かっています。必要になれば順番に今日の判断へ出ます。
          </p>
        </section>
      )}
    </div>
  )
}
