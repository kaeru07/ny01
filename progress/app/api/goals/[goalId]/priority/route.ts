import { NextResponse } from 'next/server'
import { buildAutoQueue } from '@/lib/auto-queue'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: { goalId: string } }) {
  try {
    const body = await req.json().catch(() => ({})) as { priorityBoost?: unknown; pinnedTop?: unknown }
    const data = await readGoals()
    const idx = data.goals.findIndex((goal) => goal.id === params.goalId)
    if (idx === -1) return NextResponse.json({ error: 'goal not found' }, { status: 404 })

    const boost = body.priorityBoost
    if (boost !== undefined && boost !== 0 && boost !== 1 && boost !== 2) {
      return NextResponse.json({ error: 'priorityBoost must be 0, 1, or 2' }, { status: 400 })
    }
    data.goals[idx] = {
      ...data.goals[idx],
      priorityBoost: boost === undefined ? data.goals[idx].priorityBoost : boost,
      pinnedTop: typeof body.pinnedTop === 'boolean' ? body.pinnedTop : data.goals[idx].pinnedTop,
      updatedAt: new Date().toISOString(),
    }
    await writeGoals(data)
    return NextResponse.json({ success: true, queue: await buildAutoQueue() })
  } catch (err) {
    console.error('Failed to update goal priority:', err)
    return NextResponse.json({ error: 'failed to update goal priority' }, { status: 500 })
  }
}
