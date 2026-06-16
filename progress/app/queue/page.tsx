export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { getAutoQueueView } from '@/lib/auto-queue'
import FilterBar from '@/components/newux/FilterBar'
import FilterChips from '@/components/newux/FilterChips'
import QueueActionButton from './QueueActionButton'
import { buildProgressFilterUrl, parseProgressFilters, updateFilterParam, type ProgressFilterState } from '@/lib/progress-filters'
import type { AutoQueueItem, WorkItemStatus } from '@/types/auto-queue'

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  executable: '実行可能',
  waiting_user: '判断待ち',
  ai_hold: 'AI保留',
  review_waiting: 'レビュー互換',
  blocked: 'Block',
  manual: '手動/対象外',
  done: '完了',
}

const STATUS_CLASS: Record<WorkItemStatus, string> = {
  executable: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  waiting_user: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ai_hold: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  review_waiting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  blocked: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  manual: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  done: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function formatDate(iso?: string): string {
  if (!iso) return 'なし'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function allItems(queue: Awaited<ReturnType<typeof getAutoQueueView>>): AutoQueueItem[] {
  return [
    ...queue.executable,
    ...queue.waitingUser,
    ...queue.aiHold,
    ...queue.reviewWaiting,
    ...queue.blocked,
    ...queue.manual,
  ]
}

function itemHref(item: AutoQueueItem): string {
  return item.type === 'epic' ? `/epic/${item.sourceId}` : `/goal-planner?goalId=${encodeURIComponent(item.goalId ?? '')}`
}

function queueHref(filters: ProgressFilterState, patch: Partial<ProgressFilterState>): string {
  return buildProgressFilterUrl('/queue', updateFilterParam(filters, patch))
}

function statusCount(items: AutoQueueItem[], status: WorkItemStatus): number {
  return items.filter((item) => item.status === status).length
}

function matchesQuery(item: AutoQueueItem, q?: string): boolean {
  if (!q) return true
  const haystack = [
    item.title,
    item.goalTitle,
    item.projectName,
    item.projectId,
    item.sourceId,
    item.reason,
    item.candidateBlockedReason,
    ...item.reasonFactors,
  ].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function filterItems(items: AutoQueueItem[], filters: ProgressFilterState): AutoQueueItem[] {
  return items.filter((item) => {
    if (filters.goalId && (item.goalId ?? 'unassigned') !== filters.goalId) return false
    if (filters.projectId && item.projectId !== filters.projectId) return false
    if (filters.app) {
      const app = filters.app.toLowerCase()
      const value = `${item.projectName ?? ''} ${item.projectId ?? ''} ${item.sourceId}`.toLowerCase()
      if (!value.includes(app)) return false
    }
    if (filters.status && item.status !== filters.status) return false
    if (filters.priority && item.priority !== filters.priority) return false
    if (filters.pinned && item.queueControl?.pinnedTop !== true) return false
    if (filters.excluded && item.candidateEligible) return false
    if (filters.manualOnly && item.status !== 'manual') return false
    if (filters.executor === 'unset' && item.preferredExecutor) return false
    if (filters.executor === 'set' && !item.preferredExecutor) return false
    if (filters.runnable && item.status !== 'executable') return false
    if (filters.blocked && item.status !== 'blocked') return false
    if (filters.aiHold && item.status !== 'ai_hold') return false
    if (!matchesQuery(item, filters.q)) return false
    return true
  })
}

const UNASSIGNED_GOAL = '__unassigned__'

type GoalProgressRow = Awaited<ReturnType<typeof getAutoQueueView>>['goalProgress'][number]

interface GoalGroup {
  goalId: string
  title: string
  row?: GoalProgressRow
  items: AutoQueueItem[]
}

/** items を Goal ごとにまとめ、Goal順（goalProgress=rankGoals順）に並べる。未設定は末尾。 */
function groupItemsByGoal(items: AutoQueueItem[], goalProgress: GoalProgressRow[]): GoalGroup[] {
  const order = new Map(goalProgress.map((row, index) => [row.goalId, index]))
  const groups = new Map<string, AutoQueueItem[]>()
  for (const item of items) {
    const key = item.goalId ?? UNASSIGNED_GOAL
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }
  return Array.from(groups.entries())
    .map(([goalId, groupItems]): GoalGroup => {
      const row = goalId === UNASSIGNED_GOAL ? undefined : goalProgress.find((r) => r.goalId === goalId)
      return { goalId, title: row?.title ?? groupItems[0]?.goalTitle ?? (goalId === UNASSIGNED_GOAL ? 'Goal未設定' : goalId), row, items: groupItems }
    })
    .sort((a, b) => {
      const ao = a.goalId === UNASSIGNED_GOAL ? Number.MAX_SAFE_INTEGER : order.get(a.goalId) ?? Number.MAX_SAFE_INTEGER - 1
      const bo = b.goalId === UNASSIGNED_GOAL ? Number.MAX_SAFE_INTEGER : order.get(b.goalId) ?? Number.MAX_SAFE_INTEGER - 1
      return ao - bo
    })
}

export default async function QueuePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const queue = await getAutoQueueView()
  const filters = parseProgressFilters(searchParams)
  const goalId = filters.goalId
  const goalProgress = goalId ? queue.goalProgress.find((row) => row.goalId === goalId) : undefined
  const allQueueItems = allItems(queue)
  const goalScopedItems = allQueueItems.filter((item) => !goalId || (item.goalId ?? 'unassigned') === goalId)
  const items = filterItems(allQueueItems, filters)
  const goalGroups = groupItemsByGoal(items, queue.goalProgress)
  const projectOptions = Array.from(new Map(allQueueItems.filter((item) => item.projectId || item.projectName).map((item) => [item.projectId ?? item.projectName ?? '', item.projectName ?? item.projectId ?? '未設定'])).entries())
    .filter(([id]) => id)
    .map(([value, label]) => ({ value, label }))
  const goalOptions = queue.goalProgress.map((row) => ({ value: row.goalId, label: row.title }))
  const activeChips = [
    { key: 'goalId', label: `Goal: ${goalProgress?.title ?? filters.goalId}`, active: Boolean(filters.goalId), href: queueHref(filters, { goalId: undefined }) },
    { key: 'projectId', label: `Project: ${filters.projectId}`, active: Boolean(filters.projectId), href: queueHref(filters, { projectId: undefined }) },
    { key: 'app', label: `app: ${filters.app}`, active: Boolean(filters.app), href: queueHref(filters, { app: undefined }) },
    { key: 'status', label: `状態: ${filters.status}`, active: Boolean(filters.status), href: queueHref(filters, { status: undefined }) },
    { key: 'priority', label: `優先度: ${filters.priority}`, active: Boolean(filters.priority), href: queueHref(filters, { priority: undefined }) },
    { key: 'pinned', label: 'pin済み', active: filters.pinned === true, href: queueHref(filters, { pinned: undefined }) },
    { key: 'excluded', label: '候補外', active: filters.excluded === true, href: queueHref(filters, { excluded: undefined }) },
    { key: 'manualOnly', label: '手動/対象外', active: filters.manualOnly === true, href: queueHref(filters, { manualOnly: undefined }) },
    { key: 'executor', label: `executor ${filters.executor}`, active: Boolean(filters.executor), href: queueHref(filters, { executor: undefined }) },
    { key: 'q', label: `検索: ${filters.q}`, active: Boolean(filters.q), href: queueHref(filters, { q: undefined }) },
  ]

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">自動実行キュー</h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              Epicを正本にした派生ビュー · 全{allQueueItems.length}件中 {items.length}件表示 · 実行可能 {statusCount(goalScopedItems, 'executable')}件
            </p>
          </div>
          {goalId && (
            <Link href="/queue" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
              全体に戻る
            </Link>
          )}
        </div>
        {goalId && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
            Goal: <span className="font-bold">{goalProgress?.title ?? goalId}</span> のキューだけを表示中
          </div>
        )}
        {/* 自動実行ハブの関連導線 */}
        <div className="flex flex-wrap gap-2">
          <Link href="/prompt-queue" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            作業予約（Prompt Queue）
          </Link>
          <Link href="/logs" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            実行履歴
          </Link>
          <Link href="/legacy/queue" className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800">
            旧キュー
          </Link>
        </div>
      </header>

      <FilterBar
        basePath="/queue"
        filters={filters}
        quickFilters={[
          { key: 'all', label: 'すべて', patch: { status: undefined, excluded: undefined, pinned: undefined, manualOnly: undefined, executor: undefined, blocked: undefined, aiHold: undefined }, active: !filters.status && !filters.excluded && !filters.pinned && !filters.manualOnly && !filters.executor && !filters.blocked && !filters.aiHold },
          { key: 'executable', label: '実行可', patch: { status: 'executable', excluded: undefined }, active: filters.status === 'executable' },
          { key: 'excluded', label: '候補外', patch: { excluded: true, status: undefined }, active: filters.excluded === true },
          { key: 'pinned', label: 'pin済み', patch: { pinned: true }, active: filters.pinned === true },
          { key: 'manual', label: '手動/対象外', patch: { manualOnly: true, status: undefined }, active: filters.manualOnly === true || filters.status === 'manual' },
          { key: 'executorUnset', label: 'executor未設定', patch: { executor: 'unset' }, active: filters.executor === 'unset' },
          { key: 'blocked', label: 'Block', patch: { status: 'blocked' }, active: filters.status === 'blocked' || filters.blocked === true },
          { key: 'aiHold', label: 'AI保留', patch: { status: 'ai_hold' }, active: filters.status === 'ai_hold' || filters.aiHold === true },
        ]}
        selectFilters={[
          { key: 'goalId', label: 'Goal', placeholder: 'すべてのGoal', options: goalOptions },
          { key: 'projectId', label: 'Project', placeholder: 'すべてのProject', options: projectOptions },
          { key: 'priority', label: 'Priority', placeholder: 'すべての優先度', options: ['P0', 'P1', 'P2'].map((value) => ({ value, label: value })) },
          { key: 'app', label: 'app', placeholder: 'すべてのapp', options: projectOptions },
        ]}
        showSearch
      />
      <FilterChips chips={activeChips} clearHref="/queue" />

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {[
          ['判断待ち', statusCount(goalScopedItems, 'waiting_user'), 'waiting_user'],
          ['AI保留', statusCount(goalScopedItems, 'ai_hold'), 'ai_hold'],
          ['レビュー', statusCount(goalScopedItems, 'review_waiting'), 'review_waiting'],
          ['実行可', statusCount(goalScopedItems, 'executable'), 'executable'],
          ['Block', statusCount(goalScopedItems, 'blocked'), 'blocked'],
        ].map(([label, count, key]) => (
          <Link key={key} href={queueHref(filters, { status: key as WorkItemStatus })} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
            <p className="text-[11px] font-semibold text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
          </Link>
        ))}
      </section>

      {items.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700">
          <p className="font-semibold text-gray-700 dark:text-gray-200">条件に一致する項目はありません。</p>
          <p className="mt-1 text-xs text-gray-400">現在の条件を解除するか、候補外・pin済みの観点で確認できます。</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href="/queue" className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">クリア</Link>
            <Link href={queueHref(filters, { excluded: true, status: undefined })} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">候補外を見る</Link>
            <Link href={queueHref(filters, { pinned: true })} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">pin済みを見る</Link>
            {filters.goalId && <Link href={queueHref(filters, { goalId: undefined })} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">Goal解除</Link>}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {goalGroups.map((group) => (
            <section key={group.goalId} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-1.5 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-300 dark:text-gray-600">Goal</span>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{group.title}</h2>
                  {group.row?.pinnedTop && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">最優先</span>}
                  {(group.row?.priorityBoost ?? 0) > 0 && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">boost+{group.row?.priorityBoost}</span>}
                </div>
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  {group.row && <span>実行可 {group.row.executable} · {group.row.done}/{group.row.total}（{group.row.ratio}%）</span>}
                  <span className="font-semibold text-gray-500">{group.items.length}件</span>
                  {group.goalId !== UNASSIGNED_GOAL && !filters.goalId && (
                    <Link href={queueHref(filters, { goalId: group.goalId })} className="rounded border border-gray-200 px-1.5 py-0.5 font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                      このGoalだけ
                    </Link>
                  )}
                  {group.goalId !== UNASSIGNED_GOAL && (
                    <Link href={`/goal-planner?goalId=${encodeURIComponent(group.goalId)}`} className="rounded border border-gray-200 px-1.5 py-0.5 font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                      Goal詳細
                    </Link>
                  )}
                </div>
              </div>
          {group.items.map((item) => {
            const canMove = item.type === 'epic' && item.status === 'executable'
            const isPinned = item.queueControl?.pinnedTop === true
            const isHeld = item.queueControl?.hold === true
            const pinnedButExcluded = isPinned && !item.candidateEligible
            return (
              <article
                key={item.workItemId}
                className={`rounded-lg border bg-white p-4 dark:bg-gray-900 ${
                  pinnedButExcluded
                    ? 'border-amber-300 ring-2 ring-amber-100 dark:border-amber-800 dark:ring-amber-900/40'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-gray-400">#{item.queueOrder || '-'}</span>
                  <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[11px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">{item.priority}</span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {item.preferredExecutor ?? 'executor未設定'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[item.status]}`}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  {isPinned && <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-bold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">pin</span>}
                  {item.fixRequested && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">要修正優先</span>}
                  {item.autonomyAnchor && <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[11px] font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">自走化・最優先</span>}
                  {item.reviewPending && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">レビュー未確認・継続</span>}
                  {item.source && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">source:{item.source}</span>}
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                    item.candidateEligible
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {item.candidateEligible ? '候補入り' : '候補外'}
                  </span>
                </div>

                <h2 className="mt-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-100">{item.title}</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Project {item.projectName ?? item.projectId ?? '未設定'}
                </p>
                {!item.candidateEligible && (
                  <div className={`mt-3 rounded-lg px-3 py-2 ${pinnedButExcluded ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                    <p className={`text-sm font-bold ${pinnedButExcluded ? 'text-amber-800 dark:text-amber-200' : 'text-gray-700 dark:text-gray-200'}`}>
                      {pinnedButExcluded ? 'pin済みだが候補外' : '候補外'}: {item.candidateBlockedReason ?? STATUS_LABEL[item.status]}のため、自動実行の次回候補には入りません。
                    </p>
                    {item.resolution && (
                      <div className="mt-1.5">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">👉 こうすれば動きます</p>
                        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{item.resolution.how}</p>
                        {item.resolution.actionLabel && item.resolution.actionHref && !item.resolution.actionHref.startsWith('/queue') && (
                          <Link
                            href={item.resolution.actionHref}
                            className="mt-1.5 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                          >
                            {item.resolution.actionLabel} →
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">次の理由: {item.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.reasonFactors.map((factor) => (
                    <span key={factor} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {factor}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  候補順位 {item.queueOrder || '-'} · score {item.queueScore} · doneCriteria {item.doneCriteriaDone}/{item.doneCriteriaTotal} · 最終 {formatDate(item.lastRunAt)}
                  {!item.candidateEligible ? ` · 候補外理由: ${item.candidateBlockedReason ?? STATUS_LABEL[item.status]}` : ''}
                  {item.blockers.length > 0 ? ` · blocker: ${item.blockers.join(' / ')}` : ''}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {(item.type === 'epic' || item.type === 'goal_todo') && (
                    <QueueActionButton
                      workItemId={item.workItemId}
                      action={isPinned ? 'unpin' : 'pin'}
                      title={item.status === 'executable' ? '自動実行候補の最上位に固定します' : '条件が解けて実行可能になった時に最上位へ上げます。安全gatingは上書きしません'}
                    >
                      {isPinned ? 'pin解除' : item.status === 'executable' ? '自動実行を最優先' : '復帰時に最優先'}
                    </QueueActionButton>
                  )}
                  <QueueActionButton workItemId={item.workItemId} action="moveUp" disabled={!canMove}>↑</QueueActionButton>
                  <QueueActionButton workItemId={item.workItemId} action="moveDown" disabled={!canMove}>↓</QueueActionButton>
                  {(item.type === 'epic' || item.type === 'goal_todo') && (
                    <QueueActionButton workItemId={item.workItemId} action={isHeld ? 'unhold' : 'hold'}>
                      {isHeld ? '保留解除' : 'あとで'}
                    </QueueActionButton>
                  )}
                  {item.type === 'epic' && item.factoryEligible && (
                    <QueueActionButton workItemId={item.workItemId} action="exclude" danger>対象外</QueueActionButton>
                  )}
                  {item.type === 'epic' && !item.factoryEligible && (
                    <QueueActionButton workItemId={item.workItemId} action="include">対象に戻す</QueueActionButton>
                  )}
                  {item.type === 'goal_todo' && (
                    <>
                      <QueueActionButton workItemId={item.workItemId} action="include">次回候補に戻す</QueueActionButton>
                      <QueueActionButton workItemId={item.workItemId} action="prioritize">P0で次回優先</QueueActionButton>
                      <QueueActionButton workItemId={item.workItemId} action="complete">完了</QueueActionButton>
                    </>
                  )}
                  <Link href={itemHref(item)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                    詳細
                  </Link>
                </div>
              </article>
            )
          })}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
