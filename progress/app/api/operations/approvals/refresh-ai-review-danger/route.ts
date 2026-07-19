import { NextResponse } from 'next/server'
import { buildAiReviewApprovalDraft, classifyRun } from '@/lib/ai-review'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getPendingApprovals, updatePendingApproval } from '@/lib/operations-store'
import { DANGER_CATEGORIES } from '@/lib/inbox-labels'

export const dynamic = 'force-dynamic'

export async function POST() {
  const [approvals, runs] = await Promise.all([
    getPendingApprovals(),
    readExecutionRuns(),
  ])
  const runById = new Map(runs.map((run) => [run.runId, run]))
  const updated: Array<{ approvalId: string; runId: string; title: string }> = []
  const skipped: Array<{ approvalId: string; reason: string }> = []

  for (const approval of approvals) {
    if (!approval.createdRunId) continue
    if (!DANGER_CATEGORIES.has(approval.category)) continue

    const run = runById.get(approval.createdRunId)
    if (!run) {
      skipped.push({ approvalId: approval.approvalId, reason: 'run not found' })
      continue
    }
    if (run.aiReview?.verdict !== 'needs_human' && !approval.title.startsWith('判断が必要:')) {
      skipped.push({ approvalId: approval.approvalId, reason: 'not ai-review pending approval' })
      continue
    }

    const classification = classifyRun(run)
    if (classification.verdict !== 'needs_human') {
      skipped.push({ approvalId: approval.approvalId, reason: `classification=${classification.verdict}` })
      continue
    }

    const draft = buildAiReviewApprovalDraft(run, {
      rule: classification.rule,
      reason: classification.reason,
      approvalCategory: approval.category,
    })
    const refreshed = await updatePendingApproval(approval.approvalId, {
      title: draft.title,
      options: draft.options,
      recommended: draft.recommended,
      reason: draft.reason,
      requiredForExecution: false,
    })
    if (refreshed) {
      updated.push({
        approvalId: refreshed.approvalId,
        runId: approval.createdRunId,
        title: refreshed.title,
      })
    } else {
      skipped.push({ approvalId: approval.approvalId, reason: 'update failed' })
    }
  }

  return NextResponse.json({ success: true, updated, skipped })
}
