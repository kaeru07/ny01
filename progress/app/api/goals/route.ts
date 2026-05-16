import { NextRequest, NextResponse } from 'next/server'
import { readGoals } from '@/lib/goal-reader'
import { readAppProgress } from '@/lib/progress-reader'
import { importGoal, validateGoalImport } from '@/lib/goal-writer'

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
