import { NextResponse } from 'next/server'
import { ensureDailyAppProposal } from '@/lib/app-proposal-generator'

export async function POST() {
  try {
    const result = await ensureDailyAppProposal()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'failed to generate app proposal' },
      { status: 500 },
    )
  }
}
