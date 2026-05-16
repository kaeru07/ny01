import { NextResponse } from 'next/server'
import { checkCodexStatus, getActiveRun } from '@/lib/codex-runner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await checkCodexStatus()
  const active = getActiveRun()
  return NextResponse.json({ ...status, activeRun: active }, { status: 200 })
}
