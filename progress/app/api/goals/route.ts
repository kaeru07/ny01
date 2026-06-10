import { NextRequest, NextResponse } from 'next/server'
import { readGoals } from '@/lib/goal-reader'
import { readAppProgress } from '@/lib/progress-reader'
import { importGoal, upsertGoal, validateGoalImport } from '@/lib/goal-writer'
import { recordOperationalDecision } from '@/lib/operations-store'

export async function GET() {
  try {
    const data = await readGoals()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to read goals:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (body?.action === 'upsert') {
      const goal = await upsertGoal(body.goal ?? body)
      await recordOperationalDecision({
        action: 'goal_adjust',
        topic: `Goal調整: ${goal.title}`,
        decision: `metric=${goal.metric ?? '-'} target=${goal.target ?? '-'} current=${goal.current ?? '-'} status=${goal.status}`,
        goalId: goal.id,
      })
      return NextResponse.json({ success: true, goal })
    }

    const progress = await readAppProgress()
    const projects = progress.projects.map((p) => ({ id: p.id, name: p.name }))

    if (body?.action === 'validate') {
      const result = validateGoalImport(body.payload ?? body, projects)
      return NextResponse.json(result)
    }

    const result = await importGoal(body, { projects })
    if (result.errors.length > 0 && !result.goalId) {
      return NextResponse.json({ success: false, ...result }, { status: 400 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Failed to import goal:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const goal = await upsertGoal(body.goal ?? body)
    await recordOperationalDecision({
      action: 'goal_adjust',
      topic: `Goal調整: ${goal.title}`,
      decision: `metric=${goal.metric ?? '-'} target=${goal.target ?? '-'} current=${goal.current ?? '-'} status=${goal.status}`,
      goalId: goal.id,
    })
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error('Failed to save goal:', err)
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: msg }, { status: msg.includes('required') ? 400 : 500 })
  }
}
