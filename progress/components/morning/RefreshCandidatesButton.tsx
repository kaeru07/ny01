'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshCandidatesButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function refresh() {
    setMessage(null)
    setIsError(false)
    const res = await fetch('/api/candidates', { method: 'POST' })
    if (!res.ok) {
      setMessage('更新に失敗しました')
      setIsError(true)
      return
    }
    const data = await res.json()
    setMessage(data.added > 0 ? `${data.added} 件の候補を追加しました` : '新しい候補はありません')
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-2">
      <button
        onClick={refresh}
        disabled={pending}
        className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
      >
        {pending ? '更新中...' : '候補を更新（project-tasks から取得）'}
      </button>
      {message && (
        <p className={`text-xs text-center ${isError ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
