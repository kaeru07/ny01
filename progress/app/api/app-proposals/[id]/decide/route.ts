import { NextResponse } from 'next/server'
import { recordOperationalDecision } from '@/lib/operations-store'

const decisions = ['approve', 'reject', 'hold', 'not_needed'] as const
type Decision = (typeof decisions)[number]

function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && decisions.includes(value as Decision)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) {
    return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }

  const payload = body as { decision?: unknown; note?: unknown }
  if (!isDecision(payload.decision)) {
    return NextResponse.json({ success: false, error: 'decision must be approve, reject, hold, or not_needed' }, { status: 400 })
  }

  const note = typeof payload.note === 'string' ? payload.note.trim() : undefined

  try {
    await recordOperationalDecision({
      type: 'app_proposal',
      targetId: id,
      action: payload.decision,
      topic: `App proposal: ${id}`,
      decision: payload.decision,
      note,
      source: 'app-proposals-page',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'failed to record decision' },
      { status: 500 },
    )
  }
}
