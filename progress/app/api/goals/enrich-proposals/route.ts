import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 承認待ち(proposed)ゴールに、承認カード用の詳細（できるようになること=enables / メリット=pros /
// 補足=detail）をタイトル一致で追記する手動トリガ。研究系(試した方がいい系)の候補に「試すと何が
// できて、どんな良い影響があるか」を肉付けするために使う。既存値は上書き、detail は notes 先頭へ追記。
//
// body: { items: [{ title: string, enables?: string, pros?: string[], detail?: string }] }
const DETAIL_MARK = '🔍試す価値'

export async function POST(req: Request) {
  let body: { items?: unknown }
  try {
    body = (await req.json()) as { items?: unknown }
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json body' }, { status: 400 })
  }
  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) return NextResponse.json({ success: false, error: 'items[] required' }, { status: 400 })

  const data = await readGoals()
  const now = new Date().toISOString()
  const byTitle = new Map(data.goals.filter((g) => g.status === 'proposed').map((g) => [g.title.trim(), g]))

  let updated = 0
  const notFound: string[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const it = raw as { title?: unknown; enables?: unknown; pros?: unknown; detail?: unknown }
    const title = typeof it.title === 'string' ? it.title.trim() : ''
    const g = title ? byTitle.get(title) : undefined
    if (!g) { if (title) notFound.push(title); continue }
    if (typeof it.enables === 'string' && it.enables.trim()) g.proposalEnables = it.enables.trim()
    if (Array.isArray(it.pros)) {
      const pros = it.pros.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
      if (pros.length > 0) g.proposalPros = pros
    }
    if (typeof it.detail === 'string' && it.detail.trim() && !(g.notes ?? '').includes(DETAIL_MARK)) {
      g.notes = `${DETAIL_MARK}: ${it.detail.trim()}${g.notes ? `\n${g.notes}` : ''}`
    }
    g.updatedAt = now
    updated += 1
  }

  await writeGoals(data)
  try {
    revalidatePath('/')
    revalidatePath('/decide')
  } catch (err) {
    console.warn('Failed to revalidate after enrich:', err)
  }
  return NextResponse.json({ success: true, updated, notFound })
}
