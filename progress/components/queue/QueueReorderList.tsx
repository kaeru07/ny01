'use client'

import { useState } from 'react'

interface QueueReorderItem {
  workItemId: string
  title: string
  goalTitle?: string
  projectId?: string
  pinned: boolean
}

interface QueueReorderListProps {
  items: QueueReorderItem[]
}

export function QueueReorderList({ items }: QueueReorderListProps) {
  const pinnedItems = items.filter((item) => item.pinned)
  const [order, setOrder] = useState(() => items.filter((item) => !item.pinned))
  const [saving, setSaving] = useState(false)
  const [unpinningId, setUnpinningId] = useState<string>()

  async function saveOrder(nextOrder: QueueReorderItem[], previousOrder: QueueReorderItem[]) {
    setSaving(true)
    try {
      const response = await fetch('/api/auto-queue/reorder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderedWorkItemIds: [
            ...pinnedItems.map((item) => item.workItemId),
            ...nextOrder.map((item) => item.workItemId),
          ],
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? '順番の保存に失敗しました')
      }
    } catch (error) {
      setOrder(previousOrder)
      alert(error instanceof Error ? error.message : '順番の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function move(index: number, offset: -1 | 1) {
    if (saving) return
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= order.length) return

    const previousOrder = order
    const nextOrder = [...order]
    const [movedItem] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, movedItem)
    setOrder(nextOrder)
    void saveOrder(nextOrder, previousOrder)
  }

  async function unpin(workItemId: string) {
    if (unpinningId) return
    setUnpinningId(workItemId)
    try {
      const response = await fetch('/api/auto-queue/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workItemId, action: 'unpin' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? '固定解除に失敗しました')
      }
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : '固定解除に失敗しました')
    } finally {
      setUnpinningId(undefined)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">🔀 自動実行の順番（ここで並び替え）</h2>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          上下で順番を変えると即座に反映され、その順番でAIが実行します。📌は最優先で固定中(解除可)。
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          実行可能な作業はありません
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {pinnedItems.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-amber-700 dark:text-amber-300">📌 最優先(固定)</h3>
              <ul className="mt-2 space-y-2">
                {pinnedItems.map((item) => (
                  <li
                    key={item.workItemId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3 dark:border-amber-900/60 dark:bg-amber-950/20"
                  >
                    <ItemDetails item={item} />
                    <button
                      type="button"
                      onClick={() => void unpin(item.workItemId)}
                      disabled={Boolean(unpinningId)}
                      className="shrink-0 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                    >
                      {unpinningId === item.workItemId ? '解除中' : '固定解除'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {order.length > 0 && (
            <ol className="space-y-2">
              {order.map((item, index) => (
                <li
                  key={item.workItemId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 rounded-lg bg-gray-900 px-2 py-1 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
                      #{index + 1}
                    </span>
                    <ItemDetails item={item} />
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={saving || index === 0}
                      aria-label={`${item.title}を上へ移動`}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={saving || index === order.length - 1}
                      aria-label={`${item.title}を下へ移動`}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  )
}

function ItemDetails({ item }: { item: QueueReorderItem }) {
  return (
    <div className="min-w-0">
      <p className="font-bold text-gray-900 dark:text-gray-100">{item.title}</p>
      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
        {item.goalTitle ?? 'Goal未設定'}
        {item.projectId ? ` · ${item.projectId}` : ''}
      </p>
    </div>
  )
}
