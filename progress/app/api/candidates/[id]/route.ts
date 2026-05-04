import { NextRequest, NextResponse } from 'next/server'
import { updateCandidateStatus } from '@/lib/session-writer'
import type { WorkCandidateStatus } from '@/types/session'

interface Params { params: { id: string } }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const { status, memo } = body

    const validStatuses: WorkCandidateStatus[] = ['pending_decision', 'approved', 'rejected', 'held']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updated = await updateCandidateStatus(params.id, status as WorkCandidateStatus, memo)
    return NextResponse.json({ success: true, candidate: updated })
  } catch (err) {
    console.error('Failed to update candidate:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
