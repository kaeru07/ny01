'use client'

import { useState } from 'react'
import ExecutionRunCard from './ExecutionRunCard'
import type { ExecutionRun, ReviewStatus } from '@/types/execution-run'

interface Props {
  initialRuns: ExecutionRun[]
  reviewOnly?: boolean
}

export default function ExecutionRunList({ initialRuns, reviewOnly = false }: Props) {
  const [reviewStatuses, setReviewStatuses] = useState<Record<string, ReviewStatus>>({})

  function handleReviewStatusChange(runId: string, status: ReviewStatus) {
    setReviewStatuses((prev) => ({ ...prev, [runId]: status }))
  }

  const runs = initialRuns
    .map((r) => ({
      ...r,
      reviewStatus: reviewStatuses[r.runId] ?? r.reviewStatus,
    }))
    .filter((r) => {
      if (!reviewOnly) return true
      return r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup'
    })

  if (runs.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 py-12 text-center">
        {reviewOnly ? 'レビュー待ちの実行履歴はありません' : '実行履歴がありません'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <ExecutionRunCard
          key={run.runId}
          run={run}
          onReviewStatusChange={handleReviewStatusChange}
        />
      ))}
    </div>
  )
}
