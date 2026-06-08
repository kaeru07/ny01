import { NextResponse } from 'next/server'
import { getDoneCriteriaForEpic } from '@/lib/done-criteria'

export const dynamic = 'force-dynamic'

// GET ?epicId=...: Epic の doneCriteria 自動判定結果（done/continue + 各 criterion の達成状況）。副作用なし。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const epicId = url.searchParams.get('epicId')
  if (!epicId) return NextResponse.json({ error: 'epicId is required' }, { status: 400 })
  const evaluation = await getDoneCriteriaForEpic(epicId)
  if (!evaluation) return NextResponse.json({ error: 'epic not found' }, { status: 404 })
  return NextResponse.json(evaluation)
}
