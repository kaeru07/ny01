import { NextRequest, NextResponse } from 'next/server'
import { readWorkSession } from '@/lib/session-reader'
import { updateSession } from '@/lib/session-writer'
import type { SessionStatus } from '@/types/session'

export async function GET() {
  try {
    const session = await readWorkSession()
    return NextResponse.json(session)
  } catch (err) {
    console.error('Failed to read session:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const VALID_STATUSES: SessionStatus[] = ['pending', 'in_progress', 'done', 'handoff']

    const updates: Parameters<typeof updateSession>[0] = {}
    if (typeof body.handoffText === 'string') updates.handoffText = body.handoffText
    if (typeof body.status === 'string' && VALID_STATUSES.includes(body.status)) {
      updates.status = body.status as SessionStatus
    }
    if (typeof body.startedAt === 'string') updates.startedAt = body.startedAt
    if (typeof body.endedAt === 'string') updates.endedAt = body.endedAt

    const updated = await updateSession(updates)
    return NextResponse.json({ success: true, session: updated })
  } catch (err) {
    console.error('Failed to update session:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
