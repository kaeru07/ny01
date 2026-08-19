import { NextRequest, NextResponse } from 'next/server'
import { updateReviewStatus } from '@/lib/execution-run-writer'
import { generateFollowupRecommendationForRun, runKnowledgeLoopForReviewedRun } from '@/lib/knowledge-loop'
import { recordOperationalDecision } from '@/lib/operations-store'
import { finalizeEpicAsDone } from '@/lib/epic-finalize'
import { canFinalizeReviewedRun } from '@/lib/checks-gate'
import type { ReviewStatus } from '@/types/execution-run'

interface Params {
  params: { runId: string }
}

const VALID_REVIEW_STATUSES: ReviewStatus[] = ['not_reviewed', 'copied', 'reviewed', 'needs_followup', 'needs_human', 'snoozed']

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { runId } = params
    const body = await request.json()
    const { reviewStatus } = body
    const reviewMemo = typeof body?.reviewMemo === 'string' ? body.reviewMemo : undefined
    const fixPrompt = reviewStatus === 'needs_followup' && typeof body?.fixPrompt === 'string'
      ? body.fixPrompt.trim()
      : undefined

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 })
    }
    if (!VALID_REVIEW_STATUSES.includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid reviewStatus' }, { status: 400 })
    }

    const updated = await updateReviewStatus(runId, reviewStatus as ReviewStatus, { reviewMemo, fixPrompt })
    if (!updated) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    // 人間のレビュー操作を Decision Log に残す（UI / API からの状態変更が対象）。
    await recordOperationalDecision({
      action: reviewStatus === 'reviewed' ? 'markReviewed' : 'changeReviewStatus',
      topic: `Runレビュー: ${updated.targetTodoTitle || runId}`,
      decision: `reviewStatus=${reviewStatus}${reviewMemo || fixPrompt ? '（memo更新あり）' : ''}`,
      runId,
      epicId: updated.epicId,
    })
    const knowledgeLoop = reviewStatus === 'reviewed'
      ? await runKnowledgeLoopForReviewedRun(updated)
      : null
    const followupLoop = reviewStatus === 'needs_followup'
      ? await generateFollowupRecommendationForRun(updated)
      : null
    // レビュー(問題なし)= 人間が「この作業は完了」と確定した信号。doneCriteria 自動判定が
    // continue のままでも Epic を done にし、Goal 完了まで伝播させる（完了済み作業の滞留を止める）。
    const epicFinalize = reviewStatus === 'reviewed' && updated.epicId
      && canFinalizeReviewedRun(updated.runStatus, updated.checks)
      ? await finalizeEpicAsDone(updated.epicId)
      : null
    return NextResponse.json({ success: true, knowledgeLoop, followupLoop, epicFinalize })
  } catch (err) {
    console.error('Failed to update review status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
