import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { buildResearchGoalCandidates } from '@/lib/research-goals'
import { proposeGoals } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 日々の調査結果（news-app の AIツール調査・導入価値評価★4以上）から、ゴール候補（status='proposed'）を
// 「できるだけ多く」一括登録する。通常のアイドル提案（proposeGoalsFromResearchIfNeeded）は承認待ち上限3で
// 絞るが、このエンドポイントは上限を無視してまとめて承認対象を補充するための手動トリガ。
// 既存ゴール（全status）と同名の候補は buildResearchGoalCandidates 側で除外される（承認/却下済みは蒸し返さない）。
//
// body(任意): { maxDays?: number, max?: number }  既定 maxDays=60 / max=100
export async function POST(req: Request) {
  let body: { maxDays?: unknown; max?: unknown } = {}
  try {
    body = (await req.json()) as { maxDays?: unknown; max?: unknown }
  } catch {
    // body 無しも許可（既定値で動かす）
  }
  const maxDays = typeof body.maxDays === 'number' && body.maxDays > 0 ? Math.min(body.maxDays, 365) : 60
  const max = typeof body.max === 'number' && body.max > 0 ? Math.min(body.max, 200) : 100

  try {
    const candidates = await buildResearchGoalCandidates({ maxDays, max })
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, created: [], skipped: [], reason: '新規の調査ゴール候補は見つかりませんでした（既存と重複 or 該当なし）' })
    }
    const result = await proposeGoals(candidates, { source: 'research' })
    try {
      revalidatePath('/')
      revalidatePath('/decide')
      revalidatePath('/guide')
    } catch (err) {
      console.warn('Failed to revalidate after research proposal:', err)
    }
    return NextResponse.json({
      success: true,
      createdCount: result.created.length,
      skippedCount: result.skipped.length,
      created: result.created.map((g) => ({ id: g.id, title: g.title })),
      skipped: result.skipped,
    })
  } catch (err) {
    console.error('Failed to bulk-propose research goals:', err)
    return NextResponse.json({ success: false, error: 'failed to propose research goals' }, { status: 500 })
  }
}
