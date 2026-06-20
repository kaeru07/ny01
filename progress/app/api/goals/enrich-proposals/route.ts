import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 承認待ち(proposed)ゴールを、現タイトル一致で編集する手動トリガ。
// - newTitle / summary / enables / pros / cons を上書き（指定したものだけ）。
// - detail は notes 先頭へマーカー付きで追記。
// 用途: 承認カードの肉付け、および分かりにくい内部語（P1/P2 等）を人間語へ言い換える。
//
// body: { items: [{ title: string, newTitle?: string, summary?: string,
//                    enables?: string, pros?: string[], cons?: string[], detail?: string }] }
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
    const it = raw as { title?: unknown; newTitle?: unknown; summary?: unknown; enables?: unknown; pros?: unknown; cons?: unknown; detail?: unknown }
    const title = typeof it.title === 'string' ? it.title.trim() : ''
    const g = title ? byTitle.get(title) : undefined
    if (!g) { if (title) notFound.push(title); continue }
    if (typeof it.newTitle === 'string' && it.newTitle.trim()) g.title = it.newTitle.trim()
    if (typeof it.summary === 'string' && it.summary.trim()) { g.summary = it.summary.trim(); g.description = it.summary.trim() }
    if (typeof it.enables === 'string' && it.enables.trim()) g.proposalEnables = it.enables.trim()
    if (Array.isArray(it.pros)) {
      const pros = it.pros.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim())
      if (pros.length > 0) g.proposalPros = pros
    }
    if (Array.isArray(it.cons)) {
      const cons = it.cons.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
      if (cons.length > 0) g.proposalCons = cons
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
