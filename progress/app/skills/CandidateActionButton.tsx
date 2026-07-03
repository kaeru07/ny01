'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

interface Props {
  candidateId: string
  action: 'approve' | 'snooze' | 'reject'
  children: ReactNode
}

export default function CandidateActionButton({ candidateId, action, children }: Props) {
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    try {
      const res = await fetch(`/api/skills/candidates/${encodeURIComponent(candidateId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(await res.text())
      window.location.reload()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {pending ? '処理中' : children}
    </button>
  )
}
