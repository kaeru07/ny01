import { NextResponse } from 'next/server'
import { approveRecommendation, getRecommendation } from '@/lib/recommended-epics-store'
import { recordOperationalDecision } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

// POST: おすすめを承認して Epic を追加する（人間が「承認してEpic追加」を押した時のみ）。
// 自動Epic追加は禁止。重複・二重登録は内部でブロックし 409 を返す。
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await approveRecommendation(params.id)
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 })
  }
  const rec = await getRecommendation(params.id)
  await recordOperationalDecision({
    action: 'approve',
    topic: `候補承認: ${rec?.title ?? params.id}`,
    decision: 'suggested → epic_created（Epic追加）',
    goalId: rec?.goalId,
  })
  return NextResponse.json(result)
}
