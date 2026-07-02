import { NextResponse } from 'next/server'
import { ensureBlockedDecisions } from '@/lib/blocked-decisions'

export async function POST() {
  const result = await ensureBlockedDecisions()
  return NextResponse.json({ success: true, created: result.created, closed: result.closed })
}
