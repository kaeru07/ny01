import { NextResponse } from 'next/server'
import { appendAutomationLog } from '@/lib/operations-store'
import { getSkill, upsertSkill } from '@/lib/skill-store'

interface Params {
  params: { skillId: string }
}

export async function POST(request: Request, { params }: Params) {
  const body = await request.json().catch(() => null)
  const action = body?.action
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json({ success: false, error: 'action must be enable or disable' }, { status: 400 })
  }

  const skill = await getSkill(params.skillId)
  if (!skill) {
    return NextResponse.json({ success: false, error: 'skill not found' }, { status: 404 })
  }

  const updated = await upsertSkill({
    ...skill,
    enabled: action === 'enable',
    updatedAt: new Date().toISOString(),
  })
  await appendAutomationLog({
    event: action === 'enable' ? 'skill_enabled' : 'skill_disabled',
    skillId: updated.id,
    fallbackReason: `ui_action:${action}`,
  })

  return NextResponse.json({ success: true, skill: updated })
}
