import { NextResponse } from 'next/server'
import { syncGoalTodoStatuses } from '@/lib/goal-writer'

export async function POST() {
  try {
    const result = await syncGoalTodoStatuses()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Failed to sync goal todo statuses:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
