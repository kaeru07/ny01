'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  excluded: boolean
}

export default function ExcludeToggle({ projectId, excluded }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState(excluded)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setError(null)
    const next = !current
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ excluded: next }),
    })
    if (!res.ok) {
      setError('更新に失敗しました')
      return
    }
    setCurrent(next)
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 ${
          current
            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
      >
        {current ? '処理対象外 (解除する)' : '処理対象外にする'}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
