import { NextResponse } from 'next/server'
import { getLoopClosureReport, healLoopClosure } from '@/lib/knowledge-loop'

export const dynamic = 'force-dynamic'

// GET: Execution→Review→Knowledge→Next Epic ループの閉じ具合を測定する（書き込みなし）。
// closed=true なら全段つながっている。gaps にこぼれた Run / Knowledge を列挙する。
export async function GET() {
  try {
    return NextResponse.json(await getLoopClosureReport())
  } catch (err) {
    console.error('Failed to build loop closure report:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: こぼれを既存 backfill（冪等）で自己修復し、前後レポートを返す。
export async function POST() {
  try {
    const result = await healLoopClosure()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Failed to heal loop closure:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
