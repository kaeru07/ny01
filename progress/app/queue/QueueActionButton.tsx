'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { AutoQueueControlAction } from '@/types/auto-queue'

interface Props {
  workItemId: string
  action: AutoQueueControlAction
  children: React.ReactNode
  disabled?: boolean
  danger?: boolean
  title?: string
}

export default function QueueActionButton({ workItemId, action, children, disabled = false, danger = false, title }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function run() {
    if (disabled || pending) return
    if (action === 'exclude' && !window.confirm('このEpicを自動実行対象外にします。よろしいですか？')) return
    setPending(true)
    try {
      const res = await fetch('/api/auto-queue/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workItemId, action }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error ?? '操作に失敗しました')
      }
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={disabled || pending}
      title={title}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold disabled:opacity-40 ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-300'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800'
      }`}
    >
      {pending ? '処理中' : children}
    </button>
  )
}
