import { NextResponse } from 'next/server'
import { getPendingApprovals, decideApproval } from '@/lib/operations-store'
import { updateReviewStatus } from '@/lib/execution-run-writer'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { runKnowledgeLoopForReviewedRun } from '@/lib/knowledge-loop'

export async function GET() {
  const approvals = await getPendingApprovals()
  return NextResponse.json(approvals)
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const approvalId = body?.approvalId
  const decidedOption = body?.decidedOption

  if (!approvalId || !decidedOption) {
    return NextResponse.json(
      { success: false, error: 'approvalId and decidedOption are required' },
      { status: 400 },
    )
  }

  const decided = await decideApproval(approvalId, decidedOption)
  if (!decided) {
    return NextResponse.json({ success: false, error: 'approval not found' }, { status: 404 })
  }

  // AI一次レビュー発の needs_human Run は、人間の決定内容を Run の reviewStatus に反映してループを閉じる。
  if (decided.createdRunId && (decidedOption === 'mark_reviewed' || decidedOption === 'needs_followup')) {
    const memoLine = `[人間判断 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}] approval=${decided.approvalId} 決定=${decidedOption}`
    const existing = (await readExecutionRuns()).find((r) => r.runId === decided.createdRunId)
    const memo = existing?.reviewMemo ? `${existing.reviewMemo}\n${memoLine}` : memoLine
    const updated = await updateReviewStatus(
      decided.createdRunId,
      decidedOption === 'mark_reviewed' ? 'reviewed' : 'needs_followup',
      memo,
    )
    if (updated && decidedOption === 'mark_reviewed') {
      await runKnowledgeLoopForReviewedRun(updated)
    }
  }

  return NextResponse.json({ success: true, approval: decided })
}
