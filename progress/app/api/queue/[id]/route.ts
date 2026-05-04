import { NextRequest, NextResponse } from 'next/server'
import { updateQueueItem, moveQueueItem, removeFromQueue } from '@/lib/session-writer'
import type { WorkItemStatus } from '@/types/session'

interface Params { params: { id: string } }

const VALID_STATUSES: WorkItemStatus[] = ['queued', 'in_progress', 'done', 'blocked', 'skipped']
const VALID_MOVES = ['up', 'down', 'top', 'bottom'] as const

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const body = await request.json()
    const { action, status, userMemo, workLog, taskPrompt } = body

    if (action === 'remove') {
      await removeFromQueue(params.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'move' && VALID_MOVES.includes(body.direction)) {
      const items = await moveQueueItem(params.id, body.direction)
      return NextResponse.json({ success: true, items })
    }

    const updates: Parameters<typeof updateQueueItem>[1] = {}
    if (typeof status === 'string' && (VALID_STATUSES as string[]).includes(status)) updates.status = status as WorkItemStatus
    if (typeof userMemo === 'string') updates.userMemo = userMemo
    if (typeof workLog === 'string') updates.workLog = workLog
    if (typeof taskPrompt === 'string') updates.taskPrompt = taskPrompt

    const updated = await updateQueueItem(params.id, updates)
    return NextResponse.json({ success: true, item: updated })
  } catch (err) {
    console.error('Failed to update queue item:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
