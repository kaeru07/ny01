import { NextResponse } from 'next/server'
import { buildAllInboxReviewCopy } from '@/lib/inbox-review-copy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await buildAllInboxReviewCopy()
  return NextResponse.json(payload)
}
