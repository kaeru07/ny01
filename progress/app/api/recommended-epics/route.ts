import { NextResponse } from 'next/server'
import { getRecommendations, generateRecommendations } from '@/lib/recommended-epics-store'

export const dynamic = 'force-dynamic'

// GET: おすすめ追加Epic一覧（収益化インパクト順）。
export async function GET() {
  const recommendations = await getRecommendations()
  return NextResponse.json({ recommendations })
}

// POST: 抽出を実行しておすすめを生成する（11:00/23:00/起動時の定例 or 手動）。
// 生成は status=suggested のみ。自動承認・自動Epic追加は一切行わない。
export async function POST() {
  const result = await generateRecommendations()
  return NextResponse.json({ ok: true, ...result })
}
