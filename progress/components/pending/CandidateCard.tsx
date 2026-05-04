'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkCandidate } from '@/types/session'

const EFFORT_LABEL: Record<string, string> = { small: '小', medium: '中', large: '大' }
const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}
const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }

interface Props { candidate: WorkCandidate }

export default function CandidateCard({ candidate: c }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [memo, setMemo] = useState(c.userMemo)
  const [memoSaving, setMemoSaving] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  async function updateStatus(status: string) {
    setError('')
    const res = await fetch(`/api/candidates/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, memo }),
    })
    if (!res.ok) { setError('更新失敗'); return }
    startTransition(() => router.refresh())
  }

  async function saveMemo() {
    setMemoSaving(true)
    await fetch(`/api/candidates/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: c.status, memo }),
    })
    setMemoSaving(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-blue-500 dark:text-blue-400 font-medium">{c.projectName}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">{c.taskTitle}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[c.priority]}`}>
            {PRIORITY_LABEL[c.priority]}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            {EFFORT_LABEL[c.estimatedEffort]}
          </span>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{c.reason}</p>

      {/* Expand details */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
      >
        {expanded ? '▲ 詳細を閉じる' : '▼ 詳細を見る'}
      </button>

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-gray-50 dark:border-gray-700">
          {c.doneCondition && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">完了条件</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{c.doneCondition}</p>
            </div>
          )}
          {c.prerequisites && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">事前確認</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{c.prerequisites}</p>
            </div>
          )}
          {c.risks && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">リスク</p>
              <p className="text-xs text-orange-700 dark:text-orange-300">{c.risks}</p>
            </div>
          )}
        </div>
      )}

      {/* Memo */}
      <div>
        <label className="text-xs text-gray-400 dark:text-gray-500">メモ</label>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="メモを入力..."
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button
            onClick={saveMemo}
            disabled={memoSaving}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            保存
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => updateStatus('approved')}
          disabled={pending}
          className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors"
        >
          OK
        </button>
        <button
          onClick={() => updateStatus('held')}
          disabled={pending}
          className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
        >
          保留
        </button>
        <button
          onClick={() => updateStatus('rejected')}
          disabled={pending}
          className="flex-1 py-2 rounded-xl border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400 disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-white dark:bg-gray-800"
        >
          却下
        </button>
      </div>
    </div>
  )
}
