export const dynamic = 'force-dynamic'

import { readWorkQueue, readWorkSession, sortedQueueItems } from '@/lib/session-reader'
import QueueCard from '@/components/queue/QueueCard'
import PromptCopy from '@/components/queue/PromptCopy'
import QueueControls from '@/components/queue/QueueControls'
import HandoffEditor from '@/components/queue/HandoffEditor'
import Link from 'next/link'

export default async function QueuePage() {
  const [queueData, session] = await Promise.all([readWorkQueue(), readWorkSession()])

  const sorted = sortedQueueItems(queueData.items)
  const activeItems = sorted.filter((i) => i.status === 'queued' || i.status === 'in_progress')
  const closedItems = sorted.filter(
    (i) => i.status === 'done' || i.status === 'skipped' || i.status === 'blocked',
  )
  const hasManualOrder = sorted.some((i) => i.manualOrder !== undefined)

  return (
    <div className="px-4 pt-6 pb-4 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">今日の作業順番</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          {activeItems.length} 件待機中{hasManualOrder ? ' · 手動順序あり' : ''}
        </p>
      </header>

      {/* Controls */}
      <QueueControls
        completedItems={closedItems.filter((i) => i.status === 'done')}
        blockedItems={closedItems.filter((i) => i.status === 'blocked')}
        remainingItems={activeItems}
      />

      {/* Prompt copy */}
      {sorted.length > 0 && <PromptCopy items={sorted} />}

      {/* Active queue */}
      {activeItems.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <p className="text-gray-400 dark:text-gray-500 text-sm">作業キューが空です。</p>
          <p className="text-gray-400 dark:text-gray-500 text-xs">
            <Link href="/tasks" className="text-blue-500 hover:underline">ToDo管理</Link>
            {' '}でタスクを選んで「今日の作業に追加」してください。
          </p>
        </div>
      ) : (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            作業順番 ({activeItems.length})
          </h2>
          <div className="space-y-4">
            {activeItems.map((item, idx) => (
              <QueueCard
                key={item.id}
                item={item}
                effectiveOrder={idx + 1}
                isFirst={idx === 0}
                isLast={idx === activeItems.length - 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Done / blocked items */}
      {closedItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            完了 / スキップ / ブロック ({closedItems.length})
          </h2>
          <div className="space-y-4">
            {closedItems.map((item) => {
              const globalIdx = sorted.indexOf(item)
              return (
                <QueueCard
                  key={item.id}
                  item={item}
                  effectiveOrder={globalIdx + 1}
                  isFirst={false}
                  isLast={false}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* Handoff editor */}
      <HandoffEditor initialText={session.handoffText} />
    </div>
  )
}
