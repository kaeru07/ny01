import { NextResponse } from 'next/server'
import { readWorkQueue } from '@/lib/session-reader'
import { regenerateAutoOrder } from '@/lib/session-writer'

export async function GET() {
  try {
    const data = await readWorkQueue()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to read queue:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 自動優先度再計算
export async function POST() {
  try {
    const items = await regenerateAutoOrder()
    return NextResponse.json({ success: true, items })
  } catch (err) {
    console.error('Failed to regenerate queue order:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
