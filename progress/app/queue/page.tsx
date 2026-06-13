export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { buildAutoQueue } from '@/lib/auto-queue'
import QueueActionButton from './QueueActionButton'
import type { AutoQueueItem, WorkItemStatus } from '@/types/auto-queue'

const FILTERS: Array<{ key: 'all' | WorkItemStatus; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'executable', label: '実行可能' },
  { key: 'waiting_user', label: '判断待ち' },
  { key: 'ai_hold', label: 'AI保留' },
  { key: 'review_waiting', label: 'レビュー待ち' },
  { key: 'blocked', label: 'Block' },
  { key: 'manual', label: '対象外/手動' },
]

const STATUS_LABEL: Record<WorkItemStatus, string> = {
  executable: '実行可能',
  waiting_user: '判断待ち',
  ai_hold: 'AI保留',
  review_waiting: 'レビュー待ち',
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

function allItems(queue: Awaited<ReturnType<typeof buildAutoQueue>>): AutoQueueItem[] {
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

export default async function QueuePage({ searchParams }: { searchParams?: { filter?: string } }) {
  const queue = await buildAutoQueue()
  const filter = (searchParams?.filter ?? 'all') as 'all' | WorkItemStatus
  const items = allItems(queue).filter((item) => filter === 'all' || item.status === filter)

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">自動実行キュー</h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              Epicを正本にした派生ビュー · 実行可能 {queue.counts.executable}件
            </p>
          </div>
          <Link href="/legacy/queue" className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
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
              href={f.key === 'all' ? '/queue' : `/queue?filter=${f.key}`}
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
          ['判断待ち', queue.counts.waiting_user, 'waiting_user'],
          ['AI保留', queue.counts.ai_hold, 'ai_hold'],
          ['レビュー', queue.counts.review_waiting, 'review_waiting'],
          ['実行可', queue.counts.executable, 'executable'],
          ['Block', queue.counts.blocked, 'blocked'],
        ].map(([label, count, key]) => (
          <Link key={key} href={`/queue?filter=${key}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/60">
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
            return (
              <article key={item.workItemId} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
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
                </div>

                <h2 className="mt-2 text-base font-bold leading-snug text-gray-900 dark:text-gray-100">{item.title}</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Goal {item.goalTitle ?? '未設定'} · Project {item.projectName ?? item.projectId ?? '未設定'}
                </p>
                <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">次の理由: {item.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.reasonFactors.map((factor) => (
                    <span key={factor} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {factor}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  doneCriteria {item.doneCriteriaDone}/{item.doneCriteriaTotal} · 最終 {formatDate(item.lastRunAt)}
                  {item.blockers.length > 0 ? ` · blocker: ${item.blockers.join(' / ')}` : ''}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {item.type === 'epic' && (
                    <QueueActionButton workItemId={item.workItemId} action={isPinned ? 'unpin' : 'pin'}>
                      {isPinned ? 'pin解除' : '最優先'}
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
