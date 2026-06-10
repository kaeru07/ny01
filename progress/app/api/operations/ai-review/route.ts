import { NextResponse } from 'next/server'
import { getAiReviewOverview, runAiReviewBatch } from '@/lib/ai-review'

export const dynamic = 'force-dynamic'

// GET: 一次レビュー対象の状況（not_reviewed件数 / 最古日齢 / 判定プレビュー）。書き込みなし。
export async function GET() {
  try {
    return NextResponse.json(await getAiReviewOverview())
  } catch (err) {
    console.error('Failed to build ai-review overview:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: not_reviewed Run をルールベースで一括一次レビューする（既定: 直近10件）。
// reviewed → Knowledge生成ループ / needs_human → Approval（意思決定キュー）/ partial・failed → needs_followup。
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = typeof body?.limit === 'number' ? body.limit : 10
    const result = await runAiReviewBatch(limit)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Failed to run ai-review batch:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
