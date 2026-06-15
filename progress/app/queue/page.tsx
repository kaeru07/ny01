export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { getAutoQueueView } from '@/lib/auto-queue'
import QueueActionButton from './QueueActionButton'
import type { AutoQueueItem, WorkItemStatus } from '@/types/auto-queue'

const FILTERS: Array<{ key: 'all' | WorkItemStatus; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'executable', label: '実行可能' },
  { key: 'waiting_user', label: '判断待ち' },
  { key: 'ai_hold', label: 'AI保留' },
  { key: 'review_waiting', label: 'レビュー互換' },
  { key: 'blocked', label: 'Block' },
  { key: 'manual', label: '対象外/手動' },
]

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
  return item.type === 'epic' ? `/epic/${item.sourceId}` : `/goal-planner`
}

function queueHref(filter: 'all' | WorkItemStatus, goalId?: string): string {
  const params = new URLSearchParams()
  if (filter !== 'all') params.set('filter', filter)
  if (goalId) params.set('goalId', goalId)
  const query = params.toString()
  return query ? `/queue?${query}` : '/queue'
}

function statusCount(items: AutoQueueItem[], status: WorkItemStatus): number {
  return items.filter((item) => item.status === status).length
}

export default async function QueuePage({ searchParams }: { searchParams?: { filter?: string; goalId?: string } }) {
  const queue = await getAutoQueueView()
  const filter = (searchParams?.filter ?? 'all') as 'all' | WorkItemStatus
  const goalId = searchParams?.goalId
  const goalProgress = goalId ? queue.goalProgress.find((row) => row.goalId === goalId) : undefined
  const baseItems = allItems(queue).filter((item) => !goalId || item.goalId === goalId)
  const items = baseItems.filter((item) => filter === 'all' || item.status === filter)

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">自動実行キュー</h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              Epicを正本にした派生ビュー · 実行可能 {statusCount(baseItems, 'executable')}件
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

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.key
          return (
            <Link
              key={f.key}
              href={queueHref(f.key, goalId)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                active
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </nav>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {[
          ['判断待ち', statusCount(baseItems, 'waiting_user'), 'waiting_user'],
          ['AI保留', statusCount(baseItems, 'ai_hold'), 'ai_hold'],
          ['レビュー', statusCount(baseItems, 'review_waiting'), 'review_waiting'],
          ['実行可', statusCount(baseItems, 'executable'), 'executable'],
          ['Block', statusCount(baseItems, 'blocked'), 'blocked'],
        ].map(([label, count, key]) => (
          <Link key={key} href={queueHref(key as WorkItemStatus, goalId)} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
            <p className="text-[11px] font-semibold text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{count}</p>
          </Link>
        ))}
      </section>

      {items.length === 0 ? (
        <section className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400 dark:border-gray-700">
          このフィルタの項目はありません。
        </section>
      ) : (
        <section className="space-y-3">
          {items.map((item) => {
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
                  Goal {item.goalTitle ?? '未設定'} · Project {item.projectName ?? item.projectId ?? '未設定'}
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
                  {item.type === 'epic' && (
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
                  {item.type === 'epic' && (
                    <QueueActionButton workItemId={item.workItemId} action={isHeld ? 'unhold' : 'hold'}>
                      {isHeld ? '保留解除' : '保留'}
                    </QueueActionButton>
                  )}
                  {item.type === 'epic' && item.factoryEligible && (
                    <QueueActionButton workItemId={item.workItemId} action="exclude" danger>対象外</QueueActionButton>
                  )}
                  {item.type === 'epic' && !item.factoryEligible && (
                    <QueueActionButton workItemId={item.workItemId} action="include">対象に戻す</QueueActionButton>
                  )}
                  <Link href={itemHref(item)} className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                    詳細
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
