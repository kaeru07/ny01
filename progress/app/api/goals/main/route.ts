import { NextRequest, NextResponse } from 'next/server'
import { setMainGoal } from '@/lib/goal-writer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const goalId = typeof body?.goalId === 'string' ? body.goalId.trim() : ''
    if (!goalId) return NextResponse.json({ error: 'goalId is required' }, { status: 400 })
    const data = await setMainGoal(goalId)
    return NextResponse.json({ success: true, mainGoalId: data.mainGoalId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    if (msg.startsWith('Goal not found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    console.error('Failed to set main goal:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
