import { NextRequest, NextResponse } from 'next/server'
import { addTaskDirectlyToQueue } from '@/lib/session-writer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, taskId } = body

    if (typeof projectId !== 'string' || !projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (typeof taskId !== 'string' || !taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    const result = await addTaskDirectlyToQueue(projectId, taskId)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    if (msg === 'BLOCKED') {
      return NextResponse.json({ error: 'blocked tasks cannot be added to queue' }, { status: 422 })
    }
    console.error('Failed to add task to queue:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
