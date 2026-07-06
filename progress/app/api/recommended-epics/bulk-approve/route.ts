import { NextResponse } from 'next/server'
import { approveRecommendation, changeStatus, getRecommendation } from '@/lib/recommended-epics-store'
import { recordOperationalDecision } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

// POST: 案件単位で「採用」する。代表候補を Epic化し、同一案件の重複候補をまとめてクローズする。
// ループ最終リンク（候補→Epic化）の受け渡し率を「1案件=1決定」で上げるための導線。
// Epic化は approveRecommendation（重複・contract検証つき）を経由し、自動Epic化は行わない（人間操作のみ）。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const representativeId = typeof body?.representativeId === 'string' ? body.representativeId.trim() : ''
  const candidateIds: string[] = Array.isArray(body?.candidateIds)
    ? body.candidateIds.filter((x: unknown): x is string => typeof x === 'string')
    : []
  const goalId = typeof body?.goalId === 'string' && body.goalId.trim() ? body.goalId.trim() : undefined
  if (!representativeId) {
    return NextResponse.json({ ok: false, error: 'representativeId は必須' }, { status: 400 })
  }

  const rep = await getRecommendation(representativeId)
  if (!rep) return NextResponse.json({ ok: false, error: '代表候補が見つかりません' }, { status: 404 })

  // 1) 代表を Epic化（重複・contract検証は approveRecommendation 内部）。
  const approved = await approveRecommendation(representativeId, { goalId })
  if (!approved.ok) {
    return NextResponse.json({ ok: false, error: approved.reason ?? 'Epic化に失敗しました' }, { status: 409 })
  }

  // 2) 同一案件の重複候補（代表以外）をまとめてクローズ。既に非suggestedはスキップ。
  const others = Array.from(new Set(candidateIds)).filter((id) => id !== representativeId)
  const closedTitles: string[] = []
  for (const id of others) {
    const r = await getRecommendation(id)
    if (!r || r.status !== 'suggested') continue
    const updated = await changeStatus(id, 'rejected', `同一案件を採用済み（代表 ${representativeId} を Epic化）`)
    if (updated) closedTitles.push(updated.title)
  }

  await recordOperationalDecision({
    action: 'bulkApprove',
    topic: `案件を採用してEpic化: ${rep.title}`,
    decision: `代表 ${representativeId} を Epic化 / 重複 ${closedTitles.length} 件をクローズ`,
    goalId: goalId ?? rep.goalId,
  })

  return NextResponse.json({
    ok: true,
    epicId: approved.epicId ?? approved.updatedEpicId,
    approved: 1,
    closed: closedTitles.length,
  })
}
