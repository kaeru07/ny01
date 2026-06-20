'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Approval } from '@/lib/types/operations'
import { epicPriorityLabel } from '@/lib/epic-priority-label'

interface Props {
  /** サーバーで取得済みのこの Epic の承認待ち（初期表示）。決定後は router.refresh で再取得。 */
  initial: Approval[]
}

const PRIORITY_BADGE: Record<Approval['priority'], string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
}

// Epic 詳細でその場で承認/却下できるパネル。決定は既存 API（/api/operations/approvals）へ送り、
// Decision Log への保存は decideApproval 側で自動実行される（次回 vloop に反映）。判定ロジックは持たない。
export default function InlineApprovalPanel({ initial }: Props) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  async function decide(approvalId: string, decidedOption: string) {
    setBusyId(approvalId)
    try {
      const res = await fetch('/api/operations/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decidedOption }),
      })
      if (res.ok) {
        setDoneIds((prev) => new Set(prev).add(approvalId))
        router.refresh()
      }
    } finally {
      setBusyId(null)
    }
  }

  const pending = initial.filter((a) => !doneIds.has(a.approvalId))

  if (pending.length === 0) {
    return <p className="text-sm text-gray-400">承認待ちはありません</p>
  }

  return (
    <div className="space-y-3">
      {pending.map((a) => {
        const busy = busyId === a.approvalId
        return (
          <div key={a.approvalId} className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-900/15">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.title}</span>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[a.priority]}`}>優先度{epicPriorityLabel(a.priority)}</span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{a.reason}</p>

            {/* 選択肢（推奨案にバッジ）。タップで即決定。 */}
            <div className="mt-2 space-y-1.5">
              {a.options.map((opt) => (
                <button
                  key={opt.key}
                  disabled={busy}
                  onClick={() => decide(a.approvalId, opt.key)}
                  className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                    opt.key === a.recommended
                      ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                      : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-gray-800 dark:text-gray-200">
                    <span className="font-medium">{opt.label}</span>
                    {opt.detail && <span className="ml-1 text-[11px] text-gray-400">{opt.detail}</span>}
                  </span>
                  {opt.key === a.recommended && (
                    <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">推奨</span>
                  )}
                </button>
              ))}
            </div>

            {/* 承認（推奨案で即決定）/ 却下 / 保留 */}
            <div className="mt-2 flex gap-2">
              <button
                disabled={busy}
                onClick={() => decide(a.approvalId, a.recommended)}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? '送信中…' : '承認（推奨案）'}
              </button>
              <button
                disabled={busy}
                onClick={() => decide(a.approvalId, '__reject__')}
                className="rounded-lg border border-rose-400 px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50 dark:hover:bg-rose-900/30"
              >
                却下
              </button>
              <button
                disabled={busy}
                onClick={() => decide(a.approvalId, '__hold__')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                保留
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">決定すると Decision Log に保存され、次回 vloop / 再開時に反映されます</p>
          </div>
        )
      })}
    </div>
  )
}
