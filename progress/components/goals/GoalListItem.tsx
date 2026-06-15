'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { GoalProgressRow } from '@/types/auto-queue'

interface Props {
  goalId: string
  title: string
  isMain: boolean
  phaseCount: number
  todoCount: number
  ratio: number
  queueProgress?: GoalProgressRow
}

export default function GoalListItem({ goalId, title, isMain, phaseCount, todoCount, ratio, queueProgress }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const displayRatio = queueProgress?.ratio ?? ratio

  async function makeMain() {
    setBusy(true)
    try {
      await fetch('/api/goals/main', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalId }),
      })
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-xl border p-3 space-y-3 ${isMain ? 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30'}`}>
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1 truncate">{title}</p>
        {goalId === 'goal-ai-factory-os' && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">自走化・最優先</span>
        )}
        {isMain ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white">MAIN</span>
        ) : (
          <button
            type="button"
            onClick={makeMain}
            disabled={busy}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-300 disabled:opacity-40"
          >
            {busy ? '...' : 'MAIN にする'}
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>全体進捗</span>
          <span className="font-semibold text-blue-700 dark:text-blue-300">{displayRatio}%</span>
          <span className="text-gray-400 dark:text-gray-500">({queueProgress?.done ?? 0} / {queueProgress?.total ?? 0})</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${displayRatio}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <QueueStat label="次回候補" value={queueProgress?.nextCandidateCount ?? 0} />
        <QueueStat label="実行可能" value={queueProgress?.executable ?? 0} />
        <QueueStat label="判断待ち" value={queueProgress?.waitingUser ?? 0} />
        <QueueStat label="レビュー待ち" value={queueProgress?.reviewWaiting ?? 0} />
        <QueueStat label="候補外" value={queueProgress?.manual ?? 0} />
      </div>
      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
        <p><span className="font-semibold text-gray-800 dark:text-gray-100">次にやるべきこと:</span> {queueProgress?.nextActionTitle ?? '実行可能候補なし'}</p>
        <p className="mt-1"><span className="font-semibold text-gray-800 dark:text-gray-100">最新作業:</span> {queueProgress?.latestWorkTitle ?? 'まだ作業履歴なし'}</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">旧Todo/Phase: phases {phaseCount} / todos {todoCount} / Todo進捗 {ratio}%</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Link href={`/queue?goalId=${encodeURIComponent(goalId)}`} className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
          自動実行キューを見る
        </Link>
        <Link href={`/decide?goalId=${encodeURIComponent(goalId)}`} className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          ToDoを見る
        </Link>
        <Link href="/prompt-queue" className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          作業予約
        </Link>
      </div>
    </div>
  )
}

function QueueStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-2 text-center dark:bg-gray-900/40">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
