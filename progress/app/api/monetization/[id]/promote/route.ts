import { NextResponse } from 'next/server'
import { promoteToEpic } from '@/lib/monetization-store'

export const dynamic = 'force-dynamic'

// POST: 候補を正式 Epic として登録する（人間が「Epic化」ボタンを押した時のみ）。
// 自動Epic化は禁止。重複チェック → Epic Contract生成 → epics.json追加 →
// 状態EpicCreated → 操作履歴 → ExecutionRun記録 を内部で行う。
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const result = await promoteToEpic(params.id)
  if (!result.ok) {
    // 重複・検証失敗は 409（競合）で返し、UI でブロック理由を表示する。
    return NextResponse.json(result, { status: 409 })
  }
  return NextResponse.json(result)
}
