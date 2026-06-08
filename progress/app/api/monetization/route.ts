import { NextResponse } from 'next/server'
import { getCandidates, createCandidate } from '@/lib/monetization-store'

export const dynamic = 'force-dynamic'

// GET: 収益化候補の一覧（総合スコア降順）。
export async function GET() {
  const candidates = await getCandidates()
  return NextResponse.json({ candidates })
}

// POST: 候補を新規作成（AI工場の定例発掘 or 手動）。Epic化は別エンドポイント（人間操作のみ）。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return NextResponse.json({ ok: false, error: 'name は必須です' }, { status: 400 })
  }
  const candidate = await createCandidate(body)
  return NextResponse.json({ ok: true, candidate })
}
