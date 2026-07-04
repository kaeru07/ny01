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

// Inbox の4区分（今日の判断 / ゴール承認 / 達成確認 / レビュー）をタブで切り替える。
// URLクエリを初期状態へ反映し、トップの「Inboxでレビューする」から該当レビューへ直接移動できるようにする。

// レビューが大量でも「隠れている」印象を出さないため、全件を明示ページングで見せる。
const REVIEW_PAGE_SIZE = 50

type TabKey = 'decisions' | 'goalApproval' | 'achievement' | 'reviews' | 'candidates' | 'aiHold'
type VisibleTabKey = Exclude<TabKey, 'candidates' | 'aiHold'>
type ReviewFilter = 'unconfirmed' | 'followup' | 'snoozed' | 'reviewed'
type GoalApprovalSourceFilter = 'auto' | 'other'

interface Props {
  inbox: InboxView
  notReviewedCount: number
  autoQueue: AutoQueueView
}

function tabFromQuery(value: string | null): TabKey {
  if (value === 'review' || value === 'reviews') return 'reviews'
  if (value === 'goalApproval') return 'goalApproval'
  if (value === 'achievement') return 'achievement'
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

// 「試す系」= ツール/技術を試用・検証・調査する実験的ゴール。タイトル/説明のキーワードで判定する。
type GoalApprovalKind = 'all' | 'try' | 'other'
const TRY_GOAL_PATTERN = /試す|ためす|試用|お試し|トライアル|検証|PoC|実験|調査|リサーチ|評価してみ|触ってみ/i
function isTryGoal(card: InboxCard): boolean {
  const rowsText = (card.rows ?? []).map((row) => `${row.label} ${row.text}`).join(' ')
  const text = `${card.headline ?? ''} ${card.question ?? ''} ${(card.detail ?? []).join(' ')} ${rowsText}`
  return TRY_GOAL_PATTERN.test(text)
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

function groupCardsByGoal(cards: InboxCard[], goalTitleById: Map<string, string>) {
  return Array.from(
    cards.reduce((map, card) => {
      const goalId = card.goalId ?? 'unassigned'
      const group = map.get(goalId)
      if (group) group.push(card)
      else map.set(goalId, [card])
      return map
    }, new Map<string, InboxCard[]>()),
  )
    .map(([goalId, groupCards]) => ({
      goalId,
      title:
        goalId === 'unassigned'
          ? '未紐づけ'
          : goalTitleById.get(goalId) ?? groupCards.find((card) => card.goalTitle)?.goalTitle ?? goalId,
      cards: groupCards,
    }))
    .sort((a, b) => {
      if (a.goalId === 'unassigned') return 1
      if (b.goalId === 'unassigned') return -1
      return b.cards.length - a.cards.length || a.title.localeCompare(b.title, 'ja')
    })
}

function groupCardsByProject(cards: InboxCard[], projectTitleById: Map<string, string>) {
  return Array.from(
    cards.reduce((map, card) => {
      const projectId = card.projectId ?? 'unassigned'
      const group = map.get(projectId)
      if (group) group.push(card)
      else map.set(projectId, [card])
      return map
    }, new Map<string, InboxCard[]>()),
  )
    .map(([projectId, groupCards]) => ({
      projectId,
      title:
        projectId === 'unassigned'
          ? '未分類'
          : projectTitleById.get(projectId) ?? groupCards.find((card) => card.projectTitle)?.projectTitle ?? projectId,
      cards: groupCards,
    }))
    .sort((a, b) => {
      if (a.projectId === 'unassigned') return 1
      if (b.projectId === 'unassigned') return -1
      return a.title.localeCompare(b.title, 'ja')
    })
}

function ProjectChipRow({
  groups,
  activeProjectId,
  onSelect,
}: {
  groups: Array<{ projectId: string; title: string; cards: InboxCard[] }>
  activeProjectId: string
  onSelect: (projectId: string) => void
}) {
  const total = groups.reduce((sum, group) => sum + group.cards.length, 0)
  const chipClass = (active: boolean) =>
    `min-h-8 shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300'
    }`

  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      <button type="button" onClick={() => onSelect('all')} className={chipClass(activeProjectId === 'all')}>
        すべて ({total})
      </button>
      {groups.map((group) => (
        <button
          key={group.projectId}
          type="button"
          onClick={() => onSelect(group.projectId)}
          className={chipClass(activeProjectId === group.projectId)}
        >
          {group.title} ({group.cards.length})
        </button>
      ))}
    </div>
  )
}

function BulkRecommendedButton({ projectId, count }: { projectId: string; count: number }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (projectId === 'unassigned' || count <= 0) return null

  async function decideBulk() {
    if (!armed) {
      setArmed(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/operations/approvals/bulk-recommended', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? '一括決定に失敗しました')
      setArmed(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '一括決定に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={decideBulk}
        className={`min-h-10 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
          armed
            ? 'bg-rose-600 text-white hover:bg-rose-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {armed ? `本当に一括決定（${count}件）` : `残り${count}件を推奨で一括決定`}
      </button>
      {error && <span className="max-w-48 text-right text-[11px] font-semibold text-rose-600">{error}</span>}
    </div>
  )
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
  const [goalApprovalKind, setGoalApprovalKind] = useState<GoalApprovalKind>('all')
  const [goalApprovalProject, setGoalApprovalProject] = useState('all')
  const [achievementProject, setAchievementProject] = useState('all')

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

  function changeTab(key: VisibleTabKey) {
    setTab(key)
    navigateFilters({ tab: key })
  }

  const filteredDecisions = filterCards(scopeFiltered(inbox.decisions, selectedGoalId, selectedProjectId), progressFilters)
  const filteredProposedGoals = filterCards(scopeFiltered(inbox.proposedGoals, selectedGoalId, selectedProjectId), progressFilters)
  const filteredReviews = filterCards(scopeFiltered(inbox.reviews, selectedGoalId, selectedProjectId), progressFilters, { reviewOnly: true })
  const filteredReviewedHistory = filterCards(scopeFiltered(inbox.reviewedHistory, selectedGoalId, selectedProjectId), progressFilters, { reviewOnly: true })
  const achievedGoalIdSet = new Set(inbox.achievedGoalIds)
  const filteredAchievementReviews = filteredReviews.filter((card) => Boolean(card.goalId && achievedGoalIdSet.has(card.goalId)))
  const goalTitleById = new Map(inbox.goalSummaries.map((summary) => [summary.goalId, summary.goalTitle]))
  const projectTitleById = new Map(inbox.projectSummaries.map((summary) => [summary.projectId, summary.projectTitle]))
  const achievementProjectGroups = groupCardsByProject(filteredAchievementReviews, projectTitleById)
  const decisionProjectGroups = groupCardsByProject(filteredDecisions, projectTitleById)
  const effectiveAchievementProject =
    achievementProject === 'all' || achievementProjectGroups.some((group) => group.projectId === achievementProject)
      ? achievementProject
      : 'all'
  const visibleAchievementReviews =
    effectiveAchievementProject === 'all'
      ? filteredAchievementReviews
      : filteredAchievementReviews.filter((card) => (card.projectId ?? 'unassigned') === effectiveAchievementProject)
  const groupedAchievementReviews = groupCardsByGoal(visibleAchievementReviews, goalTitleById)
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
  const tabs: Array<{ key: VisibleTabKey; label: string; count: number; alert: boolean }> = [
    { key: 'decisions', label: '今日の判断', count: filteredDecisions.length, alert: filteredDecisions.length > 0 },
    { key: 'goalApproval', label: 'ゴール承認', count: filteredProposedGoals.length, alert: filteredProposedGoals.length > 0 },
    { key: 'achievement', label: '達成確認', count: filteredAchievementReviews.length, alert: filteredAchievementReviews.length > 0 },
    { key: 'reviews', label: 'レビュー', count: reviewTotal, alert: false },
  ]

  const tabCounts = {
    decisions: filteredDecisions.length,
    goalApproval: filteredProposedGoals.length,
    achievement: filteredAchievementReviews.length,
    reviews: reviewTotal,
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
            <span>達成確認 {tabCounts.achievement}</span>
            <span>レビュー {tabCounts.reviews}</span>
            <span>要修正 {selectedGoalSummary?.followup ?? followupReviews.length}</span>
            <span>あとで {selectedGoalSummary?.snoozed ?? snoozedReviews.length}</span>
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
            { key: 'achievement', label: '達成確認', patch: { tab: 'achievement' }, active: progressFilters.tab === 'achievement' },
            { key: 'review', label: 'レビュー', patch: { tab: 'reviews' }, active: progressFilters.tab === 'reviews' },
            { key: 'followup', label: '要修正', patch: { tab: 'reviews', reviewStatus: 'needs_followup' }, active: progressFilters.tab === 'reviews' && progressFilters.reviewStatus === 'needs_followup' },
            { key: 'fixPrompt', label: 'fixPromptあり', patch: { tab: 'reviews', fixPrompt: true }, active: progressFilters.fixPrompt === true },
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
        const sourceGoals = goalApprovalSource === 'other' ? otherGoals : autoGoals
        const tryGoals = sourceGoals.filter(isTryGoal)
        const nonTryGoals = sourceGoals.filter((card) => !isTryGoal(card))
        const kindTabs: Array<{ key: GoalApprovalKind; label: string; count: number }> = [
          { key: 'all', label: 'すべて', count: sourceGoals.length },
          { key: 'try', label: '試す系', count: tryGoals.length },
          { key: 'other', label: 'それ以外', count: nonTryGoals.length },
        ]
        const shown = goalApprovalKind === 'try' ? tryGoals : goalApprovalKind === 'other' ? nonTryGoals : sourceGoals
        const groupedShown = groupCardsByProject(shown, projectTitleById)
        const effectiveGoalApprovalProject =
          goalApprovalProject === 'all' || groupedShown.some((group) => group.projectId === goalApprovalProject)
            ? goalApprovalProject
            : 'all'
        const visibleGroupedShown =
          effectiveGoalApprovalProject === 'all'
            ? groupedShown
            : groupedShown.filter((group) => group.projectId === effectiveGoalApprovalProject)
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
            {/* 内容分類 サブタブ（試す系 / それ以外） */}
            <div className="mb-3 flex flex-wrap gap-1.5">
              {kindTabs.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setGoalApprovalKind(c.key)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${goalApprovalKind === c.key ? 'bg-emerald-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`}
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
              <>
                <ProjectChipRow groups={groupedShown} activeProjectId={effectiveGoalApprovalProject} onSelect={setGoalApprovalProject} />
                <div className="space-y-3">
                {visibleGroupedShown.map((group) => (
                  <details
                    key={group.projectId}
                    open={effectiveGoalApprovalProject !== 'all'}
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
              </>
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
            <div className="space-y-3">
              {decisionProjectGroups.map((group) => (
                <section key={group.projectId} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{group.projectId === 'unassigned' ? 'その他' : group.title}</h3>
                      {group.cards.some((card) => card.approvalCategory !== 'multi_option') && (
                        <p className="mt-0.5 text-[11px] text-gray-400">危険・作業カードは対象外</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <BulkRecommendedButton
                        projectId={group.projectId}
                        count={group.cards.filter((card) => card.approvalCategory === 'multi_option').length}
                      />
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {group.cards.length}件
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-3 p-3">
                    {group.cards.map((card) => (
                      <InboxCardItem key={card.id} card={card} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {!selectedGoalId && inbox.decisionTotal > inbox.decisions.length && (
            <p className="mt-2 text-[11px] text-gray-400">ほか{inbox.decisionTotal - inbox.decisions.length}件は明日以降に順番に出ます</p>
          )}
        </section>
        {/* 「自動実行の履歴」は 実行履歴(/logs)・状況(/activity)・レポート(/report) と重複するため今日の判断からは撤去。 */}
        </>
      )}

      {/* ② ゴール達成確認（完了ゴールに紐づくレビューだけの再フレーム） */}
      {tab === 'achievement' && (
        <section className="mt-4">
          <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[11px] leading-relaxed text-green-800 dark:border-green-900/50 dark:bg-green-900/15 dark:text-green-200">
            完了したゴールの達成内容です。問題なければ『問題なし』、直したい点があれば『修正する』に要修正概要を書くと次回の自動実行で対応します。
          </div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">✅ ゴール達成確認</h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">{filteredAchievementReviews.length}件</span>
          </div>

          {filteredAchievementReviews.length === 0 ? (
            <>
              <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-xs text-gray-400 dark:border-gray-800 dark:bg-gray-900">
                達成して確認待ちのゴールはありません。
              </p>
              <EmptyGuidance currentLabel="ゴール達成確認" />
            </>
          ) : (
            <>
              <ProjectChipRow groups={achievementProjectGroups} activeProjectId={effectiveAchievementProject} onSelect={setAchievementProject} />
              <div className="space-y-3">
                {groupedAchievementReviews.map((group) => (
                  <details
                    key={group.goalId}
                    open={effectiveAchievementProject !== 'all'}
                    className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                  >
                    <summary className="min-h-12 cursor-pointer list-none px-3 py-2.5 marker:hidden">
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0 text-sm font-bold text-gray-900 dark:text-gray-100">{group.title}</span>
                        <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          確認待ち {group.cards.length}件
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
            </>
          )}
        </section>
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

      {/* 旧URL互換: Epic候補はおすすめ次作業へ移動 */}
      {tab === 'candidates' && (
        <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/15">
          <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100">この一覧は移動しました</h2>
          <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
            Epic候補は「おすすめ次作業（推薦Epic）」で確認できます。
          </p>
          <Link href="/recommended-epics" className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
            おすすめ次作業を開く
          </Link>
        </section>
      )}

      {/* 旧URL互換: AI保留は自動実行のその他ビューへ移動 */}
      {tab === 'aiHold' && (
        <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/15">
          <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100">この一覧は移動しました</h2>
          <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
            AI保留は「自動実行」のその他ビューで確認できます。
          </p>
          <Link href="/queue?view=others" className="mt-3 inline-flex rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700">
            自動実行のその他を開く
          </Link>
        </section>
      )}
    </div>
  )
}
