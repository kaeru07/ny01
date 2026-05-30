import { NextResponse } from 'next/server'
import { generateHandoffView } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const handoff = await generateHandoffView()
  return NextResponse.json(handoff)
}
