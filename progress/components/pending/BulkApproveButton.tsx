'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  pendingIds: string[]
}

export default function BulkApproveButton({ pendingIds }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (pendingIds.length === 0) return null

  async function bulkApprove() {
    setShowConfirm(false)
    setMessage(null)
    setIsError(false)
    const res = await fetch('/api/candidates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_approve', ids: pendingIds }),
    })
    if (!res.ok) {
      setMessage('一括OKに失敗しました')
      setIsError(true)
      return
    }
    const data = await res.json()
    setMessage(`${data.approved} 件をOKにして作業キューに追加しました`)
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-2">
      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          disabled={pending}
          className="w-full py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
        >
          一括OK（判定待ち {pendingIds.length} 件をすべてOK）
        </button>
      ) : (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 p-4 space-y-3">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            判定待ち {pendingIds.length} 件をすべてOKにしますか？
          </p>
          <p className="text-xs text-green-600 dark:text-green-400">
            全候補が今日の作業キューに追加されます。
          </p>
          <div className="flex gap-2">
            <button
              onClick={bulkApprove}
              disabled={pending}
              className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              まとめてOK
            </button>
            <button
              onClick={() => setShowConfirm(false)}
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
