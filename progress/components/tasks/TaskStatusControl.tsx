'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskStatus } from '@/types/progress'
import { getStatusColor, getStatusLabel } from '@/lib/progress-transform'

const STATUS_OPTIONS: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'impl_done', 'local_done', 'done', 'blocked']

interface Props {
  taskId: string
  projectId: string
  currentStatus: TaskStatus
}

export default function TaskStatusControl({ taskId, projectId, currentStatus }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)

  async function handleChange(newStatus: TaskStatus) {
    if (newStatus === currentStatus) return
    setError(false)

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, status: newStatus }),
    })

    if (!res.ok) {
      setError(true)
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {error && <span className="text-xs text-red-500 mr-1">更新失敗</span>}
      {STATUS_OPTIONS.map((s) => (
        <button
          key={s}
          disabled={pending}
          onClick={() => handleChange(s)}
          className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
            s === currentStatus
              ? getStatusColor(s) + ' ring-1 ring-offset-1 ring-current'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {getStatusLabel(s)}
        </button>
      ))}
    </div>
  )
}
