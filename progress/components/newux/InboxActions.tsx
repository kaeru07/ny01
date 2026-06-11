'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxItem } from '@/lib/command-center'

// Inbox の各項目に対する操作ボタン群。処理が成功すると router.refresh() で項目が消える。

const btn = 'rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50'
const btnPrimary = `${btn} bg-blue-600 text-white hover:bg-blue-700`
const btnGhost = `${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`
const btnDanger = `${btn} border border-rose-200 text-rose-600 dark:border-rose-900/50`

async function callApi(url: string, method: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? '処理に失敗しました')
  }
}

export default function InboxItemActions({ item }: { item: InboxItem }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [goalId, setGoalId] = useState(item.type === 'orphan_epic' ? (item.goals[0]?.id ?? '') : '')

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {item.type === 'approval' &&
          item.options.map((opt) => (
            <button
              key={opt.key}
              disabled={busy}
              className={opt.key === item.recommended ? btnPrimary : btnGhost}
              onClick={() => run(() => callApi('/api/operations/approvals', 'POST', { approvalId: item.approvalId, decidedOption: opt.key }))}
            >
              {opt.label}
              {opt.key === item.recommended && '（おすすめ）'}
            </button>
          ))}

        {item.type === 'orphan_epic' && (
          <>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {item.goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <button
              disabled={busy || !goalId}
              className={btnPrimary}
              onClick={() => run(() => callApi('/api/operations/epics', 'PATCH', { epicId: item.epicId, action: 'assignGoal', goalId }))}
            >
              この目標に紐付ける
            </button>
            <button
              disabled={busy}
              className={btnDanger}
              onClick={() => run(() => callApi('/api/operations/epics', 'PATCH', { epicId: item.epicId, action: 'drop' }))}
            >
              この作業はやめる
            </button>
          </>
        )}

        {item.type === 'candidate' && (
          <>
            <button
              disabled={busy}
              className={btnPrimary}
              onClick={() => run(() => callApi(`/api/recommended-epics/${item.recId}/approve`, 'POST', {}))}
            >
              この作業を始める（おすすめ）
            </button>
            <button
              disabled={busy}
              className={btnGhost}
              onClick={() => run(() => callApi(`/api/recommended-epics/${item.recId}`, 'PATCH', { status: 'hold', detail: 'Inboxで「あとで」を選択' }))}
            >
              あとで考える
            </button>
            <button
              disabled={busy}
              className={btnDanger}
              onClick={() => run(() => callApi(`/api/recommended-epics/${item.recId}`, 'PATCH', { status: 'rejected', detail: 'Inboxで見送りを選択' }))}
            >
              見送る
            </button>
          </>
        )}

        {item.type === 'needs_human_run' && (
          <>
            <button
              disabled={busy}
              className={btnPrimary}
              onClick={() => run(() => callApi(`/api/execution-runs/${item.runId}`, 'PATCH', { reviewStatus: 'reviewed' }))}
            >
              問題なし
            </button>
            <button
              disabled={busy}
              className={btnGhost}
              onClick={() => run(() => callApi(`/api/execution-runs/${item.runId}`, 'PATCH', { reviewStatus: 'needs_followup' }))}
            >
              直しが必要
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  )
}
