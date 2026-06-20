'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Approval } from '@/lib/types/operations'
import { epicPriorityLabel } from '@/lib/epic-priority-label'

const PRIORITY_BADGE: Record<Approval['priority'], string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  normal: 'bg-blue-100 text-blue-700',
  low: 'bg-gray-100 text-gray-600',
}

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/operations/approvals', { cache: 'no-store' })
    setApprovals(res.ok ? await res.json() : [])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function decide(approvalId: string, decidedOption: string) {
    setBusy(true)
    try {
      await fetch('/api/operations/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decidedOption }),
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">承認待ち（横断）</h1>
        <p className="mt-0.5 text-sm text-gray-400">全 Epic の承認待ちをここで決定する。決定は Decision Log に自動記録される。</p>
      </header>

      {approvals.length === 0 ? (
        <p className="text-sm text-gray-400">承認待ちはありません。</p>
      ) : (
        approvals.map((a) => (
          <div key={a.approvalId} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.title}</span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${PRIORITY_BADGE[a.priority]}`}>優先度{epicPriorityLabel(a.priority)}</span>
            </div>
            {a.epicId && (
              <Link href={`/epic/${a.epicId}`} className="mt-0.5 inline-block text-[11px] text-blue-600 hover:underline">
                {a.epicId} →
              </Link>
            )}
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{a.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {a.options.map((opt) => (
                <button
                  key={opt.key}
                  disabled={busy}
                  onClick={() => decide(a.approvalId, opt.key)}
                  className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${
                    opt.key === a.recommended ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                disabled={busy}
                onClick={() => decide(a.approvalId, '__hold__')}
                className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
              >
                保留
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
