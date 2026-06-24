'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  goalId: string
  title: string
  isMain: boolean
  phaseCount: number
  todoCount: number
  incompleteTodoCount: number
  updatedAt?: string
  ratio: number
}

export default function GoalListItem({ goalId, title, isMain, phaseCount, todoCount, incompleteTodoCount, updatedAt, ratio }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function formatDate(iso?: string): string {
    if (!iso) return 'なし'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  }

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
          <span>Todo進捗</span>
          <span className="font-semibold text-blue-700 dark:text-blue-300">{ratio}%</span>
          <span className="text-gray-400 dark:text-gray-500">({todoCount - incompleteTodoCount} / {todoCount})</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div className="h-full bg-blue-600 dark:bg-blue-500" style={{ width: `${ratio}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <GoalStat label="Phase数" value={phaseCount} />
        <GoalStat label="Todo数" value={todoCount} />
        <GoalStat label="未完Todo" value={incompleteTodoCount} />
      </div>
      <div className="rounded-lg border border-gray-100 bg-white px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300">
        <p><span className="font-semibold text-gray-800 dark:text-gray-100">最終更新:</span> {formatDate(updatedAt)}</p>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">旧Todo/Phase: phases {phaseCount} / todos {todoCount} / Todo進捗 {ratio}%</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Link href={`/goal-planner?goalId=${encodeURIComponent(goalId)}`} className="rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-bold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white">
          Goal詳細
        </Link>
        <Link href={`/decide?goalId=${encodeURIComponent(goalId)}`} className="rounded-lg border border-gray-200 px-3 py-2 text-center text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
          ToDoを見る
        </Link>
      </div>
    </div>
  )
}

function GoalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2 py-2 text-center dark:bg-gray-900/40">
      <p className="text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
