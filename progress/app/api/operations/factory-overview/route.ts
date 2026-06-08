import { NextResponse } from 'next/server'
import { getFactoryOverview } from '@/lib/factory-overview'

export const dynamic = 'force-dynamic'

// GET: Factory状態カード用の読み取り専用ビュー（副作用なし）。
// 既存 computeFactoryStatus / schedule-status / ExecutionRun を集約して
// 一般ユーザー向け表現に整形するだけ。Factory ロジックには触らない。
export async function GET() {
  const overview = await getFactoryOverview()
  return NextResponse.json(overview)
}
