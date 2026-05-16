'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  goalId: string
  title: string
  isMain: boolean
  phaseCount: number
  todoCount: number
  ratio: number
}

export default function GoalListItem({ goalId, title, isMain, phaseCount, todoCount, ratio }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function makeMain() {
    setBusy(true)
    try {
      await fetch('/api/goals/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-xl border p-3 ${isMain ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30'}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1 truncate">{title}</p>
        {isMain ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">MAIN</span>
        ) : (
          <button
            type="button"
            onClick={makeMain}
            disabled={busy}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-40"
          >
            {busy ? '...' : 'MAIN にする'}
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">phases: {phaseCount} / todos: {todoCount} / 進捗: {ratio}%</p>
    </div>
  )
}
