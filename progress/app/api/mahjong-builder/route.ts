import { NextResponse } from 'next/server'
import { appendQuestion, countQuestions, TILE_GROUPS, SEATS, SEAT_LABEL, type BuilderInput } from '@/lib/mahjong-builder'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 麻雀問題ビルダー: 入力候補と現在の問題数を返す
export async function GET() {
  return NextResponse.json({
    tileGroups: TILE_GROUPS,
    seats: SEATS.map((s) => ({ key: s, label: SEAT_LABEL[s] })),
    total: await countQuestions(),
  })
}

// 問題を1件 apps/mahjong の questions.json へ追記する
export async function POST(request: Request) {
  let body: BuilderInput
  try {
    body = (await request.json()) as BuilderInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  try {
    const result = await appendQuestion(body)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'save failed' }, { status: 400 })
  }
}
