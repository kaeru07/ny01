import { NextResponse } from 'next/server'
import { buildReviewCopyMarkdown } from '@/lib/review-copy'

export const dynamic = 'force-dynamic'

export async function GET() {
  const payload = await buildReviewCopyMarkdown()
  return NextResponse.json(payload)
}
