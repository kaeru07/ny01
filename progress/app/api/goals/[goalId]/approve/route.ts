import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { setGoalApproval } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 提案ゴール(status='proposed')を承認(→active=自動実行対象)または却下(→dropped)する。
// Inbox(今日の判断)の「ゴール承認」カードのボタンから呼ばれる。
export async function POST(req: Request, { params }: { params: { goalId: string } }) {
  try {
    const body = (await req.json().catch(() => ({}))) as { approve?: unknown }
    const approve = body.approve !== false // 既定は承認。明示 false のときだけ却下。
    const goal = await setGoalApproval(params.goalId, approve)
    if (!goal) return NextResponse.json({ error: 'goal not found' }, { status: 404 })
    try {
      revalidatePath('/')
      revalidatePath('/decide')
      revalidatePath('/queue')
      revalidatePath('/goal-planner')
    } catch (err) {
      console.warn('Failed to revalidate after goal approval:', err)
    }
    return NextResponse.json({ success: true, goal })
  } catch (err) {
    console.error('Failed to approve goal:', err)
    return NextResponse.json({ error: 'failed to approve goal' }, { status: 500 })
  }
}
