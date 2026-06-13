'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 「AIにまとめて確認させる」ボタン（人間語版）。
// 中身は AI一次レビュー（POST /api/operations/ai-review）で、結果も人間語で表示する。

interface BatchResponse {
  success?: boolean
  processed?: number
  counts?: { reviewed: number; needs_human: number; partial: number; failed: number }
  approvalsCreated?: number
  notReviewedRemaining?: number
  error?: string
}

export default function AiCheckButton({ notReviewedCount }: { notReviewedCount: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BatchResponse | null>(null)
  const [error, setError] = useState('')

  async function runCheck() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/operations/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 10件固定をやめ、未確認の全件を対象にする（サーバ側で安全上限200件）。
        body: JSON.stringify({ limit: Math.max(1, notReviewedCount) }),
      })
      const data: BatchResponse = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? '確認に失敗しました')
      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '確認に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="ai-check" className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">未確認レビューをAIで一括整理</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            未確認の作業履歴（AIの作業結果でまだ中身を見ていないもの）が
            <span className="font-bold"> {notReviewedCount}件 </span>
            あります。AIが問題ないものを自動で片付け、判断が必要なもの・危険なものは必ず一覧に残します。最終判断（問題なし / 修正する / あとで）は人間が行えます。
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={busy || notReviewedCount === 0}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? '確認中…' : `未確認${notReviewedCount}件をAIで整理`}
        </button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
      {result && result.counts && (
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {result.processed}件を確認しました — 問題なし {result.counts.reviewed}件 / あなたの判断が必要 {result.counts.needs_human}件
          / 直しが必要 {result.counts.partial + result.counts.failed}件。残り {result.notReviewedRemaining ?? '-'}件。
          {result.counts.needs_human > 0 && ' 判断が必要なものは下の一覧に追加されています。'}
        </p>
      )}
    </div>
  )
}
