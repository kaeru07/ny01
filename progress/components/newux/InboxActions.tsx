'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxCard, InboxCardAction } from '@/lib/command-center'
import { KIND_CHIP_LABEL } from '@/lib/inbox-labels'

// 「今日の判断」カード本体（6分類: 検収/実行許可/方針選択/人間作業/危険判断 + AI保留は非表示）。
// 社長向け: 状況見出し + ラベル付き説明行 + ボタン1つで終わり。
// 内部情報（元タイトル / runId / AI判断理由）は「詳細を見る」を押した時だけ開く。
// api: null のアクション（あとで）は状態を変えず、今日の画面から閉じるだけ。

const btn = 'rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50'
const toneClass: Record<InboxCardAction['tone'], string> = {
  primary: `${btn} bg-blue-600 text-white hover:bg-blue-700`,
  ghost: `${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`,
  danger: `${btn} border border-rose-200 text-rose-600 dark:border-rose-900/50`,
}

const KIND_CHIP_CLASS: Record<string, string> = {
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  acceptance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  direction: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  permission: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  human_task: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

async function callApi(api: NonNullable<InboxCardAction['api']>): Promise<void> {
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

export default function InboxCardItem({ card }: { card: InboxCard }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [closedForToday, setClosedForToday] = useState(false)

  async function run(api: InboxCardAction['api']) {
    if (!api) {
      // 「あとで」(状態を変えない) は今日の画面から閉じるだけ
      setClosedForToday(true)
      return
    }
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

  if (closedForToday) return null

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_CHIP_CLASS[card.kind]}`}>
        {KIND_CHIP_LABEL[card.kind]}
      </span>
      <p className="mt-2 text-base font-bold leading-relaxed text-gray-900 dark:text-gray-100">{card.headline}</p>

      {card.rows.length > 0 && (
        <dl className="mt-2 space-y-1">
          {card.rows.map((row) => (
            <div key={row.label} className="flex gap-1.5 text-xs leading-relaxed">
              <dt className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">{row.label}:</dt>
              <dd className="min-w-0 text-gray-700 dark:text-gray-200">{row.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {card.question && (
        <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{card.question}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {card.kind === 'direction' && card.epicId && card.goals ? (
          <>
            {card.goals.map((g) => (
              <button
                key={g.id}
                disabled={busy}
                className={toneClass.ghost}
                onClick={() => run({ url: '/api/operations/epics', method: 'PATCH', body: { epicId: card.epicId, action: 'assignGoal', goalId: g.id } })}
              >
                {g.title}
              </button>
            ))}
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
    </li>
  )
}
