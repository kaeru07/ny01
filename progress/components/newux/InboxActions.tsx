'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxCard, InboxCardAction } from '@/lib/command-center'

// 「今日の判断」カードの操作部。社長向け: ボタンを1つ押せば終わり。
// 内部情報（runId / 内部ステータス等）は「詳細を見る」を押した時だけ開く。

const btn = 'rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50'
const toneClass: Record<InboxCardAction['tone'], string> = {
  primary: `${btn} bg-blue-600 text-white hover:bg-blue-700`,
  ghost: `${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`,
  danger: `${btn} border border-rose-200 text-rose-600 dark:border-rose-900/50`,
}

async function callApi(api: InboxCardAction['api']): Promise<void> {
  const res = await fetch(api.url, {
    method: api.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(api.body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? '処理に失敗しました')
  }
}

export default function InboxCardActions({ card }: { card: InboxCard }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [goalId, setGoalId] = useState(card.goals?.[0]?.id ?? '')

  async function run(api: InboxCardAction['api']) {
    setBusy(true)
    setError('')
    try {
      await callApi(api)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {card.kind === 'goal' && card.epicId ? (
          <>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="max-w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {card.goals?.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
            <button
              disabled={busy || !goalId}
              className={toneClass.primary}
              onClick={() => run({ url: '/api/operations/epics', method: 'PATCH', body: { epicId: card.epicId, action: 'assignGoal', goalId } })}
            >
              この目標に紐付ける
            </button>
            <button
              disabled={busy}
              className={toneClass.danger}
              onClick={() => run({ url: '/api/operations/epics', method: 'PATCH', body: { epicId: card.epicId, action: 'drop' } })}
            >
              不要
            </button>
          </>
        ) : (
          card.actions.map((action) => (
            <button key={action.label} disabled={busy} className={toneClass[action.tone]} onClick={() => run(action.api)}>
              {action.label}
            </button>
          ))
        )}
      </div>

      <button
        className="mt-2 text-[11px] font-medium text-gray-400 underline-offset-2 hover:underline dark:text-gray-500"
        onClick={() => setShowDetail((v) => !v)}
      >
        {showDetail ? '詳細を閉じる' : '詳細を見る'}
      </button>
      {showDetail && (
        <ul className="mt-1.5 space-y-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
          {card.detail.map((line, i) => (
            <li key={i} className="break-all text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">・{line}</li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
    </div>
  )
}
