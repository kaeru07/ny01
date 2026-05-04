import { NextRequest, NextResponse } from 'next/server'
import { updateReviewStatus } from '@/lib/execution-run-writer'
import type { ReviewStatus } from '@/types/execution-run'

interface Params {
  params: { runId: string }
}

const VALID_REVIEW_STATUSES: ReviewStatus[] = ['not_reviewed', 'copied', 'reviewed', 'needs_followup']

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { runId } = params
    const body = await request.json()
    const { reviewStatus } = body

    if (!runId) {
      return NextResponse.json({ error: 'runId is required' }, { status: 400 })
    }
    if (!VALID_REVIEW_STATUSES.includes(reviewStatus)) {
      return NextResponse.json({ error: 'Invalid reviewStatus' }, { status: 400 })
    }

    const updated = await updateReviewStatus(runId, reviewStatus as ReviewStatus)
    if (!updated) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to update review status:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
