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
import Link from 'next/link'
import { useState } from 'react'
import { epicPriorityLabel } from '@/lib/epic-priority-label'

interface QueueReorderItem {
  workItemId: string
  title: string
  goalTitle?: string
  projectId?: string
  pinned: boolean
  summary?: string
  status?: string
  priority?: 'P0' | 'P1' | 'P2'
  reason?: string
  reasonFactors?: string[]
  blockers?: string[]
  doneCriteriaDone?: number
  doneCriteriaTotal?: number
  detailHref?: string
}

interface QueueReorderListProps {
  items: QueueReorderItem[]
}

const STATUS_LABEL: Record<string, string> = {
  executable: '実行可能',
  waiting_user: '判断待ち',
  ai_hold: 'AI保留',
  review_waiting: 'レビュー互換',
  blocked: 'Block',
  manual: '手動/対象外',
  done: '完了',
}

export function QueueReorderList({ items }: QueueReorderListProps) {
  const pinnedItems = items.filter((item) => item.pinned)
  const [order, setOrder] = useState(() => items.filter((item) => !item.pinned))
  const [detail, setDetail] = useState<QueueReorderItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [pinningId, setPinningId] = useState<string>()
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

  function moveToEnd(index: number) {
    if (saving || index === order.length - 1) return
    const previousOrder = order
    const nextOrder = [...order]
    const [movedItem] = nextOrder.splice(index, 1)
    nextOrder.push(movedItem)
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

  async function pin(workItemId: string) {
    if (pinningId) return
    setPinningId(workItemId)
    try {
      const response = await fetch('/api/auto-queue/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workItemId, action: 'pin' }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? '最優先への移動に失敗しました')
      }
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : '最優先への移動に失敗しました')
    } finally {
      setPinningId(undefined)
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
                {pinnedItems.map((item, index) => (
                  <li
                    key={item.workItemId}
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-2.5 py-2 dark:border-amber-900/60 dark:bg-amber-950/20"
                  >
                    <CompactItem item={item} number={index + 1} pinned />
                    <div className="flex shrink-0 items-center gap-1">
                      <DetailButton onClick={() => setDetail(item)} />
                      <button
                        type="button"
                        onClick={() => void unpin(item.workItemId)}
                        disabled={Boolean(unpinningId)}
                        className="rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-800 dark:bg-gray-900 dark:text-amber-200 dark:hover:bg-amber-950/40"
                      >
                        {unpinningId === item.workItemId ? '解除中' : '固定解除'}
                      </button>
                    </div>
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
                      disabled={saving || Boolean(pinningId)}
                      onMove={move}
                      onMoveToEnd={moveToEnd}
                      onPin={(workItemId) => void pin(workItemId)}
                      onDetail={() => setDetail(item)}
                      number={pinnedItems.length + index + 1}
                      pinning={pinningId === item.workItemId}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}

      {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
    </section>
  )
}

function SortableRow({
  item,
  index,
  itemCount,
  disabled,
  onMove,
  onMoveToEnd,
  onPin,
  onDetail,
  number,
  pinning,
}: {
  item: QueueReorderItem
  index: number
  itemCount: number
  disabled: boolean
  onMove: (index: number, offset: -1 | 1) => void
  onMoveToEnd: (index: number) => void
  onPin: (workItemId: string) => void
  onDetail: () => void
  number: number
  pinning: boolean
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
      className={`touch-none flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2 dark:border-gray-800 ${
        isDragging ? 'relative z-10 opacity-60' : ''
      }`}
    >
      <span
        aria-hidden="true"
        className="shrink-0 cursor-grab text-sm text-gray-400 active:cursor-grabbing dark:text-gray-500"
      >
        ⠿
      </span>
      <CompactItem item={item} number={number} />
      <div className="flex max-w-[10rem] shrink-0 flex-wrap items-center justify-end gap-1">
        <DetailButton onClick={onDetail} stopPointerPropagation />
        <button
          type="button"
          onClick={() => onPin(item.workItemId)}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={disabled}
          aria-label={`${item.title}を最優先に固定`}
          className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
        >
          {pinning ? '移動中' : '最優先'}
        </button>
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={disabled || index === 0}
          aria-label={`${item.title}を上へ移動`}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={disabled || index === itemCount - 1}
          aria-label={`${item.title}を下へ移動`}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={() => onMoveToEnd(index)}
          onPointerDown={(event) => event.stopPropagation()}
          disabled={disabled || index === itemCount - 1}
          aria-label={`${item.title}を最後尾へ移動`}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          最後尾
        </button>
      </div>
    </li>
  )
}

function CompactItem({
  item,
  number,
  pinned = false,
}: {
  item: QueueReorderItem
  number: number
  pinned?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="break-words text-xs font-bold text-gray-900 dark:text-gray-100">
          <span className="mr-1 text-gray-400 dark:text-gray-500">
            {pinned ? '📌 ' : ''}#{number}
          </span>
          {item.title}
        </p>
        <p className="mt-0.5 break-words text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          {item.summary || '概要なし'}
        </p>
      </div>
      {item.priority && (
        <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">
          {epicPriorityLabel(item.priority)}
        </span>
      )}
    </div>
  )
}

function DetailButton({
  onClick,
  stopPointerPropagation = false,
}: {
  onClick: () => void
  stopPointerPropagation?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={stopPointerPropagation ? (event) => event.stopPropagation() : undefined}
      className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      詳細
    </button>
  )
}

function DetailModal({
  item,
  onClose,
}: {
  item: QueueReorderItem
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-auto rounded-xl bg-white p-4 shadow-xl dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-detail-title"
      >
        <h2 id="queue-detail-title" className="font-bold text-gray-900 dark:text-gray-100">
          {item.title}
        </h2>

        <div className="mt-2 flex flex-wrap gap-2">
          {item.status && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          )}
          {item.priority && (
            <span className="rounded bg-gray-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-gray-100 dark:text-gray-900">
              優先度{epicPriorityLabel(item.priority)}
            </span>
          )}
        </div>

        {(item.goalTitle || item.projectId) && (
          <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
            {item.goalTitle && <p>目標: {item.goalTitle}</p>}
            {item.projectId && <p>案件: {item.projectId}</p>}
          </div>
        )}

        <div className="mt-4">
          <h3 className="text-xs font-bold text-gray-900 dark:text-gray-100">なぜこれが次か</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
            {item.reason || '理由はありません'}
          </p>
        </div>

        {item.reasonFactors && item.reasonFactors.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.reasonFactors.map((factor, index) => (
              <span
                key={`${factor}-${index}`}
                className="rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {factor}
              </span>
            ))}
          </div>
        )}

        {item.blockers && item.blockers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs font-bold text-rose-700 dark:text-rose-300">ブロッカー</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-rose-700 dark:text-rose-300">
              {item.blockers.map((blocker, index) => (
                <li key={`${blocker}-${index}`}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}

        {(item.doneCriteriaDone !== undefined || item.doneCriteriaTotal !== undefined) && (
          <p className="mt-4 text-xs text-gray-600 dark:text-gray-300">
            完了条件 {item.doneCriteriaDone ?? 0}/{item.doneCriteriaTotal ?? 0}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          {item.detailHref && (
            <Link
              href={item.detailHref}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              詳細ページを開く
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
