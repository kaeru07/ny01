import { NextResponse } from 'next/server'
import { updateAppFactoryCandidateSpec } from '@/lib/app-factory-candidates'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import { recordOperationalDecision } from '@/lib/operations-store'

const MAX_FIELD_LENGTH = 10_000

function editableText(value: unknown): string | undefined | null {
  if (value === undefined) return undefined
  if (typeof value !== 'string') return null
  return value.trim().slice(0, MAX_FIELD_LENGTH)
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json' }, { status: 400 })
  }

  const payload = body && typeof body === 'object'
    ? body as { spec?: unknown; mvpScope?: unknown; intentNote?: unknown }
    : {}
  const spec = editableText(payload.spec)
  const mvpScope = editableText(payload.mvpScope)
  const intentNote = editableText(payload.intentNote)
  if (spec === null || mvpScope === null || intentNote === null) {
    return NextResponse.json({ success: false, error: 'editable fields must be strings' }, { status: 400 })
  }
  if (spec === undefined && mvpScope === undefined && intentNote === undefined) {
    return NextResponse.json({ success: false, error: 'no editable fields supplied' }, { status: 400 })
  }

  const candidate = await updateAppFactoryCandidateSpec(params.id, { spec, mvpScope })
  if (!candidate) {
    return NextResponse.json({ success: false, error: 'app proposal not found' }, { status: 404 })
  }

  let goalId: string | undefined
  if (intentNote !== undefined) {
    const goals = await readGoals()
    const goal = goals.goals.find((item) =>
      (candidate.sourceProjectId !== null && item.id === `goal-app-${candidate.sourceProjectId}`)
      || (candidate.sourceProjectId !== null && item.projectId === candidate.sourceProjectId)
      || item.title === `${candidate.title}を作る`,
    )
    if (goal) {
      goal.notes = intentNote || undefined
      goal.updatedAt = new Date().toISOString()
      goalId = goal.id
      await writeGoals(goals)
    }
  }

  await recordOperationalDecision({
    action: 'update_app_spec',
    topic: `${candidate.title}のアプリ仕様編集`,
    decision: 'spec_updated',
    type: 'app_spec_edit',
    targetId: candidate.id,
    goalId,
    note: ['spec', 'mvpScope', 'intentNote']
      .filter((field) => payload[field as keyof typeof payload] !== undefined)
      .join(', '),
    source: 'app-specs-page',
  })

  return NextResponse.json({
    success: true,
    candidate: { id: candidate.id, spec: candidate.spec, mvpScope: candidate.mvpScope },
    goalId,
    warning: intentNote !== undefined && !goalId ? '対応するGoalが見つからないため意図メモは保存されませんでした' : undefined,
  })
}
