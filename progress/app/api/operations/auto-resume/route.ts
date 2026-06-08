import { NextResponse } from 'next/server'
import { evaluateAutoResume, triggerAutoResume } from '@/lib/auto-resume'

export const dynamic = 'force-dynamic'

// GET: Auto Resume の状態評価（副作用なし）。UI 表示・ポーリング用。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const epicId = url.searchParams.get('epicId') ?? undefined
  const result = await evaluateAutoResume(epicId || undefined)
  return NextResponse.json(result)
}

// POST: Auto Resume のトリガ。canResume なら ExecutionRun + Automation Log に記録して再開する。
//   - 安全ゲート（evaluateAutoFallback）は変更せず再利用。再開不可なら記録のみで実行しない。
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const epicId = typeof body?.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined
  const result = await triggerAutoResume(epicId)
  return NextResponse.json(result)
}
