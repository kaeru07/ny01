'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { StalledGoal } from '@/lib/stalled-goals'

const prospectClass: Record<StalledGoal['prospect'], string> = {
  likely: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  needs_decision: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  unlikely: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
}

const prospectLabel: Record<StalledGoal['prospect'], string> = {
  likely: '解消見込みあり',
  needs_decision: '判断が必要',
  unlikely: '自然解消は低い',
}

const severityClass: Record<StalledGoal['severity'], string> = {
  stalled: 'bg-rose-700 text-white dark:bg-rose-500 dark:text-rose-950',
  warn: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
}

function dayText(value: number): string {
  return `${Math.max(0, Math.floor(value))}日`
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : '更新に失敗しました')
  }
  return res.json()
}

export default function StalledGoalCard({ item }: { item: StalledGoal }) {
  const router = useRouter()
  const [hidden, setHidden] = useState(false)
  const [busy, setBusy] = useState<'pause' | 'done' | 'priority' | null>(null)
  const [message, setMessage] = useState('')
  const isDoneLeak = item.prospect === 'likely' && item.cause.includes('done化漏れ')
  const isPriorityLoss = item.cause.includes('キュー内で優先度が低く')

  async function updateStatus(status: 'paused' | 'done') {
    setBusy(status === 'paused' ? 'pause' : 'done')
    setMessage('')
    try {
      await postJson(`/api/goals/${encodeURIComponent(item.goal.id)}/status`, { status })
      setHidden(true)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setBusy(null)
    }
  }

  async function raisePriority() {
    setBusy('priority')
    setMessage('')
    try {
      await postJson(`/api/goals/${encodeURIComponent(item.goal.id)}/priority`, { priorityBoost: 2, pinnedTop: true })
      setMessage('優先度を上げました。次回のキュー選定に反映されます。')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '更新に失敗しました')
    } finally {
      setBusy(null)
    }
  }

  if (hidden) return null

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-black ${severityClass[item.severity]}`}>
              {item.severity === 'stalled' ? '長期未解消' : '警告'}
            </span>
            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {item.goal.status}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${prospectClass[item.prospect]}`}>
              {prospectLabel[item.prospect]}
            </span>
          </div>
          <h2 className="mt-2 break-words text-base font-black leading-snug text-gray-950 dark:text-gray-100">
            {item.goal.title}
          </h2>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            最後の前進から {dayText(item.stalledDays)}・承認から {dayText(item.ageDays)}
          </p>
        </div>
        <Link
          href={`/goal-planner?goalId=${encodeURIComponent(item.goal.id)}`}
          className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          Goal詳細
        </Link>
      </div>

      <dl className="mt-4 grid gap-2">
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
          <dt className="text-[11px] font-black text-gray-500 dark:text-gray-400">原因</dt>
          <dd className="mt-0.5 text-sm font-semibold leading-relaxed text-gray-900 dark:text-gray-100">{item.cause}</dd>
        </div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
          <dt className="text-[11px] font-black text-blue-700 dark:text-blue-300">解消方法</dt>
          <dd className="mt-0.5 text-sm font-semibold leading-relaxed text-blue-950 dark:text-blue-100">{item.resolution}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateStatus('paused')}
          disabled={busy !== null}
          className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
        >
          {busy === 'pause' ? '保留中...' : '保留にする'}
        </button>
        {isDoneLeak ? (
          <button
            type="button"
            onClick={() => updateStatus('done')}
            disabled={busy !== null}
            className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === 'done' ? '完了中...' : '完了にする'}
          </button>
        ) : null}
        {isPriorityLoss ? (
          <button
            type="button"
            onClick={raisePriority}
            disabled={busy !== null}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
          >
            {busy === 'priority' ? '更新中...' : '優先度を上げる'}
          </button>
        ) : null}
      </div>
      {message ? <p className="mt-3 text-xs font-semibold text-gray-600 dark:text-gray-300">{message}</p> : null}
    </article>
  )
}
