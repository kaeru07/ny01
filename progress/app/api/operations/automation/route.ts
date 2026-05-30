import { NextResponse } from 'next/server'
import { computeAutomationReadiness } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const readiness = await computeAutomationReadiness()
    return NextResponse.json(readiness)
  } catch (err) {
    console.error('Failed to compute automation readiness:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
