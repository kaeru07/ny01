import { NextResponse } from 'next/server'
import { computeHealthSummary } from '@/lib/operations-store'

export async function GET() {
  const summary = await computeHealthSummary()
  return NextResponse.json(summary)
}
