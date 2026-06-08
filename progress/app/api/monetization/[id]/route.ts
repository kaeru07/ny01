import { NextResponse } from 'next/server'
import {
  getCandidate,
  updateCandidate,
  changeStatus,
  addResearchLog,
} from '@/lib/monetization-store'
import type { CandidateStatus, ResearchLog } from '@/types/monetization'

export const dynamic = 'force-dynamic'

// GET: 候補詳細。
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const candidate = await getCandidate(params.id)
  if (!candidate) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ candidate })
}

// PATCH: 候補更新。
//   - action='status'         : 状態遷移（保留/却下/再調査 等）。body.status を使う。
//   - action='research'       : 調査履歴を追加。body.log を使う。
//   - それ以外                 : 任意フィールドの部分更新（body をそのまま merge）。
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })

  if (body.action === 'status') {
    const status = body.status as CandidateStatus
    const updated = await changeStatus(params.id, status, body.detail)
    if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, candidate: updated })
  }

  if (body.action === 'research') {
    const log = body.log as ResearchLog
    if (!log || !log.note) return NextResponse.json({ ok: false, error: 'log.note は必須' }, { status: 400 })
    const updated = await addResearchLog(params.id, {
      date: log.date || new Date().toISOString().slice(0, 10),
      type: log.type || 'note',
      note: log.note,
    })
    if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
    return NextResponse.json({ ok: true, candidate: updated })
  }

  const { id: _ignore, ...patch } = body
  const updated = await updateCandidate(params.id, patch)
  if (!updated) return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, candidate: updated })
}
