'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkQueueItem } from '@/types/session'

interface Props {
  completedItems?: WorkQueueItem[]
  blockedItems?: WorkQueueItem[]
  remainingItems?: WorkQueueItem[]
}

export default function QueueControls({
  completedItems = [],
  blockedItems = [],
  remainingItems = [],
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)

  function notify(msg: string | null, error = false) {
    setMessage(msg)
    setIsError(error)
  }

  async function autoGenerate() {
    notify(null)
    const res = await fetch('/api/queue', { method: 'POST' })
    if (!res.ok) { notify('自動生成に失敗しました', true); return }
    notify('自動順序を再計算しました（手動順序は維持）')
    startTransition(() => router.refresh())
  }

  async function fullReset() {
    setShowResetConfirm(false)
    notify(null)
    const res = await fetch('/api/queue/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'full_reset' }),
    })
    if (!res.ok) { notify('リセットに失敗しました', true); return }
    notify('完全リセット完了。手動順序をすべてクリアしました。')
    startTransition(() => router.refresh())
  }

  async function endSession() {
    setShowEndConfirm(false)
    notify(null)
    const now = new Date().toISOString()
    const dateStr = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    const lines: string[] = [`【作業終了 ${dateStr}】`, '']

    if (completedItems.length > 0) {
      lines.push(`✓ 完了 ${completedItems.length} 件:`)
      completedItems.forEach((i) => lines.push(`  - ${i.projectName}: ${i.taskTitle}`))
      lines.push('')
    }

    if (blockedItems.length > 0) {
      lines.push(`⚠ ブロック中 ${blockedItems.length} 件（要確認）:`)
      blockedItems.forEach((i) => lines.push(`  - ${i.projectName}: ${i.taskTitle}`))
      lines.push('')
    }

    if (remainingItems.length > 0) {
      lines.push(`→ 未完了 ${remainingItems.length} 件（次回継続）:`)
      remainingItems.forEach((i) => lines.push(`  - [${i.priority}] ${i.projectName}: ${i.taskTitle}`))
      lines.push('')
    }

    lines.push('次回: ToDo管理で着手判定を確認し、今日の順番を整えてください。')
    if (remainingItems.length > 0) {
      lines.push('未完了タスクは自動的に作業キューに残っています。')
    }

    const res = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'handoff', handoffText: lines.join('\n'), endedAt: now }),
    })
    if (!res.ok) { notify('セッション終了に失敗しました', true); return }
    notify('セッションを終了して引き継ぎ文を生成しました。下の「次回への引き継ぎ」欄を確認してください。')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={autoGenerate}
          disabled={pending}
          className="flex-1 py-2.5 px-3 rounded-xl border border-blue-200 dark:border-blue-800 text-sm font-medium text-blue-600 dark:text-blue-400 disabled:opacity-50 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors bg-white dark:bg-gray-800"
        >
          自動生成
        </button>
        <button
          onClick={() => setShowResetConfirm(true)}
          disabled={pending || showResetConfirm}
          className="flex-1 py-2.5 px-3 rounded-xl border border-red-200 dark:border-red-800 text-sm font-medium text-red-500 dark:text-red-400 disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-white dark:bg-gray-800"
        >
          完全リセット
        </button>
      </div>

      <button
        onClick={() => setShowEndConfirm(true)}
        disabled={pending || showEndConfirm}
        className="w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
      >
        今日の作業を終了して引き継ぎ生成
      </button>

      {showResetConfirm && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4 space-y-3">
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">
            ⚠️ 手動順序をすべてリセットします
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            ユーザーが設定した並び替えが消去されます。本当に実行しますか？
          </p>
          <div className="flex gap-2">
            <button
              onClick={fullReset}
              disabled={pending}
              className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              リセットする
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {showEndConfirm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 space-y-3">
          <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
            今日の作業を終了しますか？
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            完了: {completedItems.length} 件 / ブロック: {blockedItems.length} 件 / 未完了: {remainingItems.length} 件
            <br />
            タスク名を含む引き継ぎ文を自動生成します。
          </p>
          <div className="flex gap-2">
            <button
              onClick={endSession}
              disabled={pending}
              className="flex-1 py-2 rounded-xl bg-gray-700 dark:bg-gray-600 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              終了して引き継ぎ生成
            </button>
            <button
              onClick={() => setShowEndConfirm(false)}
              className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-xs text-center ${isError ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
