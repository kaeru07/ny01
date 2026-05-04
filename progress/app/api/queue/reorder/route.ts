import { NextRequest, NextResponse } from 'next/server'
import { reorderQueue, fullResetQueueOrder } from '@/lib/session-writer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.mode === 'full_reset') {
      const items = await fullResetQueueOrder()
      return NextResponse.json({ success: true, items })
    }

    if (!Array.isArray(body.orderedIds)) {
      return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
    }

    const items = await reorderQueue(body.orderedIds as string[], 'user')
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Failed to reorder queue:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
