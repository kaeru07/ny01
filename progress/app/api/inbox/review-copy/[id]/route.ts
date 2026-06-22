import { NextResponse } from 'next/server'
import { buildInboxReviewCopy } from '@/lib/inbox-review-copy'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const payload = await buildInboxReviewCopy(params.id)
  if (!payload) {
    return NextResponse.json({ error: 'Review target not found' }, { status: 404 })
  }
  return NextResponse.json(payload)
}
