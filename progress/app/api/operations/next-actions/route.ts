import { NextResponse } from 'next/server'
import { generatePendingApprovalTasks, getNextActionCandidates } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const candidates = await getNextActionCandidates(Number.isFinite(limit) ? limit : 20)
  return NextResponse.json({ candidates })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const limit = typeof body?.limit === 'number' ? body.limit : 10
  const result = await generatePendingApprovalTasks(limit)
  return NextResponse.json({ success: true, ...result })
}
