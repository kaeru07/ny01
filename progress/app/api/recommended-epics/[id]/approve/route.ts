import { NextResponse } from 'next/server'
import { approveRecommendation } from '@/lib/recommended-epics-store'

export const dynamic = 'force-dynamic'

// POST: おすすめを承認して Epic を追加する（人間が「承認してEpic追加」を押した時のみ）。
// 自動Epic追加は禁止。重複・二重登録は内部でブロックし 409 を返す。
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await approveRecommendation(params.id)
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 })
  }
  return NextResponse.json(result)
}
