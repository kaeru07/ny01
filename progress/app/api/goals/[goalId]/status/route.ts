import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import type { GoalStatus } from '@/types/goal'

const ALLOWED_STATUSES: GoalStatus[] = ['paused', 'done', 'active', 'dropped']

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request, { params }: { params: { goalId: string } }) {
  try {
    const body = await req.json().catch(() => ({})) as { status?: unknown }
    if (!ALLOWED_STATUSES.includes(body.status as GoalStatus)) {
      return NextResponse.json({ error: 'status must be paused, done, active, or dropped' }, { status: 400 })
    }

    const data = await readGoals()
    const idx = data.goals.findIndex((goal) => goal.id === params.goalId)
    if (idx === -1) return NextResponse.json({ error: 'goal not found' }, { status: 404 })

    const now = new Date().toISOString()
    data.goals[idx] = {
      ...data.goals[idx],
      status: body.status as GoalStatus,
      updatedAt: now,
      current: body.status === 'done' ? data.goals[idx].target ?? data.goals[idx].current : data.goals[idx].current,
    }
    await writeGoals(data)

    for (const path of ['/', '/stalled-goals', '/goal-planner', '/goal-dashboard', '/queue']) {
      try {
        revalidatePath(path)
      } catch {
        // best effort
      }
    }

    return NextResponse.json({ success: true, goal: data.goals[idx] })
  } catch (err) {
    console.error('Failed to update goal status:', err)
    const msg = err instanceof Error ? err.message : 'failed to update goal status'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
