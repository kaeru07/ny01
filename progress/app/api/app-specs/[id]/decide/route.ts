import { NextResponse } from 'next/server'
import { getAppProposals } from '@/lib/app-proposals'
import { recordOperationalDecision } from '@/lib/operations-store'

const decisions = ['approve', 'hold'] as const
type Decision = (typeof decisions)[number]

function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && decisions.includes(value as Decision)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params
  if (!id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }

  const payload = body as { decision?: unknown; note?: unknown }
  if (!isDecision(payload.decision)) {
    return NextResponse.json({ success: false, error: 'decision must be approve or hold' }, { status: 400 })
  }

  const apps = await getAppProposals()
  const app = apps.find((item) => item.id === id)
  if (!app) return NextResponse.json({ success: false, error: 'app not found' }, { status: 404 })

  const note = typeof payload.note === 'string' ? payload.note.trim() : undefined
  const entry = await recordOperationalDecision({
    type: 'app_spec',
    targetId: id,
    action: payload.decision,
    topic: `App spec: ${app.name}`,
    decision: payload.decision,
    note,
    source: 'app-specs-page',
  })

  return NextResponse.json({ success: true, decisionId: entry.decisionId })
}
