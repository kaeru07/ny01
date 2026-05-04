'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  blockers: string[]
}

export default function BlockersEditor({ projectId, blockers }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newBlocker, setNewBlocker] = useState('')
  const [error, setError] = useState('')

  async function save(nextBlockers: string[]) {
    setError('')
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockers: nextBlockers }),
    })
    if (!res.ok) {
      setError('更新に失敗しました')
      return
    }
    startTransition(() => router.refresh())
  }

  async function handleAdd() {
    const text = newBlocker.trim()
    if (!text) return
    setNewBlocker('')
    await save([...blockers, text])
  }

  async function handleDelete(index: number) {
    await save(blockers.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      {blockers.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">ブロッカーなし</p>
      ) : (
        <ul className="space-y-1.5">
          {blockers.map((b, i) => (
            <li key={i} className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl px-3 py-2.5">
              <span className="text-red-500 mt-0.5 flex-shrink-0 text-sm">⚠</span>
              <p className="text-sm text-red-800 dark:text-red-300 flex-1 leading-snug">{b}</p>
              <button
                disabled={pending}
                onClick={() => handleDelete(i)}
                aria-label="削除"
                className="flex-shrink-0 text-red-300 hover:text-red-500 disabled:opacity-40 transition-colors p-1 -m-1"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <input
          type="text"
          value={newBlocker}
          onChange={(e) => setNewBlocker(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          placeholder="ブロッカーを追加..."
          className="flex-1 rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
          disabled={pending}
        />
        <button
          onClick={handleAdd}
          disabled={pending || !newBlocker.trim()}
          className="px-4 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-600 transition-colors"
        >
          追加
        </button>
      </div>
    </div>
  )
}
