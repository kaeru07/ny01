import { NextResponse } from 'next/server'
import { readCodexRun } from '@/lib/codex-run-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } },
) {
  const run = await readCodexRun(params.runId)
  if (!run) {
    return NextResponse.json({ error: 'codex run が見つかりません' }, { status: 404 })
  }
  return NextResponse.json({ run }, { status: 200 })
}
