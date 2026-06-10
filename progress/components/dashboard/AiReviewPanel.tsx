'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface BatchCounts {
  reviewed: number
  needs_human: number
  partial: number
  failed: number
}

interface BatchResponse {
  success?: boolean
  processed?: number
  counts?: BatchCounts
  knowledgeCreated?: number
  approvalsCreated?: number
  notReviewedRemaining?: number
  oldestNotReviewedAgeDays?: number | null
  error?: string
}

export default function AiReviewPanel({
  notReviewedCount,
  oldestAgeDays,
}: {
  notReviewedCount: number
  oldestAgeDays: number | null
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BatchResponse | null>(null)
  const [error, setError] = useState('')

  async function runBatch() {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/operations/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 10 }),
      })
      const data: BatchResponse = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? '一次レビューに失敗しました')
      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '一次レビューに失敗しました')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-900/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-600 dark:text-gray-300">
          <p>
            未レビュー <span className="font-bold text-gray-900 dark:text-gray-100">{notReviewedCount}件</span>
            {oldestAgeDays !== null && <span> · 最古 {oldestAgeDays}日前</span>}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            ルールベース判定: reviewed → Knowledge生成 / needs_human → 意思決定キュー / partial・failed → 修復候補
          </p>
        </div>
        <button
          onClick={runBatch}
          disabled={running || notReviewedCount === 0}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {running ? '一次レビュー中…' : 'AI一次レビュー実行（直近10件）'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      {result && result.counts && (
        <div className="mt-2 rounded-lg bg-white p-2.5 text-xs dark:bg-gray-900">
          <p className="font-semibold text-gray-900 dark:text-gray-100">
            {result.processed}件処理: reviewed {result.counts.reviewed} / needs_human {result.counts.needs_human} / partial {result.counts.partial} / failed {result.counts.failed}
          </p>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Knowledge生成 {result.knowledgeCreated ?? 0}件 · 意思決定キュー追加 {result.approvalsCreated ?? 0}件 · 残り未レビュー {result.notReviewedRemaining ?? '-'}件
            {typeof result.oldestNotReviewedAgeDays === 'number' && ` · 最古 ${result.oldestNotReviewedAgeDays}日前`}
          </p>
        </div>
      )}
    </div>
  )
}
