import { NextResponse } from 'next/server'
import { scanFactoryDispatch, buildDispatchPlan, dispatchForExecutor } from '@/lib/factory-dispatch'
import type { ExecutorChoice } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

// GET: Factory Dispatch のスキャン結果（picked / candidates / blocked）。
//   ?epicId=... を付けるとその Epic 1 件の Dispatch Plan だけ返す。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const epicId = url.searchParams.get('epicId')
  if (epicId) {
    const plan = await buildDispatchPlan(epicId)
    if (!plan) return NextResponse.json({ error: 'epic not found' }, { status: 404 })
    return NextResponse.json({ plan })
  }
  const scan = await scanFactoryDispatch()
  return NextResponse.json(scan)
}

// POST: 指定 executor 向けの dispatch プロンプトを生成する（コピー用・CLI は呼ばない）。
//   body: { epicId, executor: 'claude' | 'codex' }
//   safety NG / codex 不可 のときは prompt=null を返す。生成イベントは Automation Log に残す。
const VALID: ExecutorChoice[] = ['claude', 'codex', 'manual']
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const epicId = typeof body?.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined
  const executor = VALID.includes(body?.executor) ? (body.executor as ExecutorChoice) : undefined
  if (!epicId || !executor) {
    return NextResponse.json({ error: 'epicId and executor (claude|codex) are required' }, { status: 400 })
  }
  const result = await dispatchForExecutor(epicId, executor)
  if (!result) return NextResponse.json({ error: 'epic not found' }, { status: 404 })
  return NextResponse.json(result)
}
