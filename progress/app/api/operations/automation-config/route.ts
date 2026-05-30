import { NextResponse } from 'next/server'
import { getAutomationConfig, updateAutomationConfig } from '@/lib/operations-store'
import type { AutomationConfig } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

const MODES: AutomationConfig['executorMode'][] = ['claude', 'codex', 'both']

export async function GET() {
  return NextResponse.json(await getAutomationConfig())
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const patch: Partial<Omit<AutomationConfig, 'updatedAt'>> = {}
  if (typeof body.executorMode === 'string' && MODES.includes(body.executorMode)) {
    patch.executorMode = body.executorMode
  }
  if (typeof body.autoResume === 'boolean') patch.autoResume = body.autoResume
  if (typeof body.autoFallback === 'boolean') patch.autoFallback = body.autoFallback
  const updated = await updateAutomationConfig(patch)
  return NextResponse.json(updated)
}
