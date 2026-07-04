import { NextResponse } from 'next/server'
import { applyApprovalEffect } from '@/lib/approval-effects'
import { DANGER_CATEGORIES } from '@/lib/inbox-labels'
import { decideApproval, getPendingApprovals } from '@/lib/operations-store'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const projectId = typeof body?.projectId === 'string' ? body.projectId : ''

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: 'projectId is required' },
      { status: 400 },
    )
  }

  const pending = await getPendingApprovals()
  const targets = pending.filter((approval) => (
    approval.projectId === projectId
    && approval.category === 'multi_option'
    && !DANGER_CATEGORIES.has(approval.category)
    && approval.options.some((option) => option.key === approval.recommended)
  ))

  let decided = 0
  for (const approval of targets) {
    const result = await decideApproval(approval.approvalId, approval.recommended, 'operator_bulk')
    if (!result) continue
    await applyApprovalEffect(result, approval.recommended)
    decided += 1
  }

  return NextResponse.json({ success: true, decided })
}
