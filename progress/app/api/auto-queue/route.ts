import { NextResponse } from 'next/server'
import { buildAutoQueue } from '@/lib/auto-queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(await buildAutoQueue())
  } catch (err) {
    console.error('Failed to build auto queue:', err)
    return NextResponse.json({ error: 'failed to build auto queue' }, { status: 500 })
  }
}
