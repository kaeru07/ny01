import { NextResponse } from 'next/server'
import { getRecommendation, changeStatus } from '@/lib/recommended-epics-store'
import type { RecommendationStatus } from '@/types/recommended-epic'

export const dynamic = 'force-dynamic'

// GET: おすすめ詳細。
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const rec = await getRecommendation(params.id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ recommendation: rec })
}

// PATCH: 状態遷移（保留 hold / 却下 rejected / 再調査 suggested など）。
// 承認(Epic追加)は /approve エンドポイント（人間操作のみ）。
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body.status !== 'string') {
    return NextResponse.json({ ok: false, error: 'status は必須' }, { status: 400 })
  }
  const status = body.status as RecommendationStatus
  if (status === 'epic_created') {
    return NextResponse.json({ ok: false, error: 'epic_created は /approve 経由でのみ設定できます' }, { status: 400 })
  }
  const updated = await changeStatus(params.id, status, body.detail)
  if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, recommendation: updated })
}
