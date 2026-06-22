import { NextResponse } from 'next/server'
import { getRecommendation, changeStatus } from '@/lib/recommended-epics-store'
import { recordOperationalDecision } from '@/lib/operations-store'
import type { RecommendationStatus } from '@/types/recommended-epic'

export const dynamic = 'force-dynamic'

// POST: 候補をまとめて状態遷移する（保留 hold / 却下 rejected / 再調査 suggested）。
// ループ最終リンク（候補→トリアージ）の滞留は、同一案件への重複 followup が
// 1件ずつしか捌けないことが主因。consolidatedPending の candidateIds を一括処理し、
// 「1案件=1判断」で受け渡し率を上げてループを閉じるための導線。
// 承認(Epic化 epic_created)は人間操作専用の /approve のみ。ここでは扱わない。
const BULK_ALLOWED: RecommendationStatus[] = ['hold', 'rejected', 'suggested']

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body || !Array.isArray(body.ids) || body.ids.length === 0 || typeof body.status !== 'string') {
    return NextResponse.json({ ok: false, error: 'ids(配列) と status は必須' }, { status: 400 })
  }
  const status = body.status as RecommendationStatus
  if (status === 'epic_created' || status === 'approved') {
    return NextResponse.json(
      { ok: false, error: 'epic_created / approved は /approve 経由でのみ設定できます' },
      { status: 400 },
    )
  }
  if (!BULK_ALLOWED.includes(status)) {
    return NextResponse.json(
      { ok: false, error: `一括変更できる status は ${BULK_ALLOWED.join(' / ')} のみ` },
      { status: 400 },
    )
  }

  const ids: string[] = Array.from(new Set(body.ids.filter((x: unknown): x is string => typeof x === 'string')))
  const detail = typeof body.detail === 'string' ? body.detail : undefined
  const updatedTitles: string[] = []
  const notFound: string[] = []
  let goalId: string | undefined

  for (const id of ids) {
    const before = await getRecommendation(id)
    if (!before) {
      notFound.push(id)
      continue
    }
    const updated = await changeStatus(id, status, detail)
    if (updated) {
      updatedTitles.push(updated.title)
      goalId = goalId ?? updated.goalId
    }
  }

  // 一括操作は 1 件の運用判断として記録する（候補数ぶんログを溢れさせない）。
  if (updatedTitles.length > 0) {
    await recordOperationalDecision({
      action: status === 'rejected' ? 'bulkReject' : 'bulkChangeCandidateStatus',
      topic: `候補を一括${status === 'hold' ? '保留' : status === 'rejected' ? '却下' : '再調査'}（${updatedTitles.length}件）`,
      decision: `status=${status}${detail ? `（${detail}）` : ''} / 対象: ${updatedTitles.slice(0, 5).join(' / ')}${updatedTitles.length > 5 ? ' ほか' : ''}`,
      goalId,
    })
  }

  return NextResponse.json({
    ok: true,
    status,
    requested: ids.length,
    updated: updatedTitles.length,
    notFound,
  })
}
