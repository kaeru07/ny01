'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  )

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

  function handleDragEnd(event: DragEndEvent) {
    if (saving) return

    const { active, over } = event
    if (!over || active.id === over.id) return

    const previousOrder = order
    const oldIndex = order.findIndex((item) => item.workItemId === active.id)
    const newIndex = order.findIndex((item) => item.workItemId === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const nextOrder = arrayMove(order, oldIndex, newIndex)
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
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          長押しで持って上下にスライドしても並び替えできます。
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
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={order.map((item) => item.workItemId)}
                strategy={verticalListSortingStrategy}
              >
                <ol className="space-y-2">
                  {order.map((item, index) => (
                    <SortableRow
                      key={item.workItemId}
                      item={item}
                      index={index}
                      itemCount={order.length}
                      disabled={saving}
                      onMove={move}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </section>
  )
}

function SortableRow({
  item,
  index,
  itemCount,
  disabled,
  onMove,
}: {
  item: QueueReorderItem
  index: number
  itemCount: number
  disabled: boolean
  onMove: (index: number, offset: -1 | 1) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.workItemId,
    disabled,
  })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className={`touch-none flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-3 dark:border-gray-800 ${
        isDragging ? 'relative z-10 opacity-60' : ''
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="shrink-0 cursor-grab text-base text-gray-400 active:cursor-grabbing dark:text-gray-500"
        >
          ⠿
        </span>
        <span className="shrink-0 rounded-lg bg-gray-900 px-2 py-1 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">
          #{index + 1}
        </span>
        <ItemDetails item={item} />
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={disabled || index === 0}
          aria-label={`${item.title}を上へ移動`}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={disabled || index === itemCount - 1}
          aria-label={`${item.title}を下へ移動`}
          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ↓
        </button>
      </div>
    </li>
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
