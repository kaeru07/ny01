import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { proposeGoals, type ProposeGoalInput } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 自動実行中にAIが考えたゴール候補を登録する（status='proposed'）。
// Factory のアイドル時ディスパッチ（提案タスク）を受けた Claude / Codex 実行者、
// または手動/スクリプトから呼ぶ。承認されるまで自動実行対象にはならない。
//
// body: { candidates: ProposeGoalInput[], source?: string }
//   ProposeGoalInput: { title(必須), summary?, projectId?, metric?, target?, current?, priority?, rationale?, source? }
export async function POST(req: Request) {
  let body: { candidates?: unknown; source?: unknown }
  try {
    body = (await req.json()) as { candidates?: unknown; source?: unknown }
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json body' }, { status: 400 })
  }

  const raw = Array.isArray(body?.candidates) ? body.candidates : []
  if (raw.length === 0) {
    return NextResponse.json({ success: false, error: 'candidates[] required' }, { status: 400 })
  }
  const candidates = raw.filter((c): c is ProposeGoalInput => Boolean(c) && typeof (c as ProposeGoalInput).title === 'string')

  try {
    const result = await proposeGoals(candidates, { source: typeof body.source === 'string' ? body.source : undefined })
    try {
      revalidatePath('/')
      revalidatePath('/decide')
    } catch (err) {
      console.warn('Failed to revalidate after goal proposal:', err)
    }
    return NextResponse.json({
      success: true,
      created: result.created.map((g) => ({ id: g.id, title: g.title })),
      skipped: result.skipped,
    })
  } catch (err) {
    console.error('Failed to propose goals:', err)
    return NextResponse.json({ success: false, error: 'failed to propose goals' }, { status: 500 })
  }
}
