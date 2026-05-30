import { NextResponse } from 'next/server'
import { getPendingApprovals, decideApproval } from '@/lib/operations-store'

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

  return NextResponse.json({ success: true, approval: decided })
}
