import { NextResponse } from 'next/server'
import { createApproval } from '@/lib/operations-store'
import { applySkillImprovement } from '@/lib/skill-apply'
import { readSkillImprovementCandidates, updateSkillImprovementCandidateStatus } from '@/lib/skill-store'

interface Params {
  params: { id: string }
}

async function readAction(request: Request): Promise<string | undefined> {
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null)
    return typeof body?.action === 'string' ? body.action : undefined
  }
  const form = await request.formData().catch(() => null)
  const value = form?.get('action')
  return typeof value === 'string' ? value : undefined
}

export async function POST(request: Request, { params }: Params) {
  const action = await readAction(request)
  if (action !== 'approve' && action !== 'snooze' && action !== 'reject') {
    return NextResponse.json({ success: false, error: 'action must be approve, snooze, or reject' }, { status: 400 })
  }

  const candidate = (await readSkillImprovementCandidates()).find((item) => item.id === params.id)
  if (!candidate) {
    return NextResponse.json({ success: false, error: 'candidate not found' }, { status: 404 })
  }

  if (action === 'snooze') {
    const updated = await updateSkillImprovementCandidateStatus(params.id, 'snoozed')
    return NextResponse.json({ success: true, candidate: updated })
  }
  if (action === 'reject') {
    const updated = await updateSkillImprovementCandidateStatus(params.id, 'rejected')
    return NextResponse.json({ success: true, candidate: updated })
  }

  if (candidate.riskFlags.length === 0) {
    const applied = await applySkillImprovement(params.id)
    return NextResponse.json({ success: applied.applied, applied })
  }

  const approval = await createApproval({
    projectId: 'skills',
    title: `Skill改善反映: ${candidate.skillId} candidate:${candidate.id}`,
    category: 'multi_option',
    priority: candidate.priority === 'P0' ? 'high' : 'normal',
    options: [
      { key: 'apply', label: '反映する' },
      { key: 'reject', label: '却下' },
      { key: 'hold', label: '保留' },
    ],
    recommended: 'hold',
    reason: `candidate:${candidate.id}\n${candidate.reason}\n${candidate.suggestedChange}`,
  })
  return NextResponse.json({ success: true, approval })
}
