import { NextResponse } from 'next/server'
import { getAutoQueueView } from '@/lib/auto-queue'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    return NextResponse.json(await getAutoQueueView())
  } catch (err) {
    console.error('Failed to build auto queue:', err)
    return NextResponse.json({ error: 'failed to build auto queue' }, { status: 500 })
  }
}
