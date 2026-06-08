import { NextResponse } from 'next/server'
import { getEpics, createEpic } from '@/lib/operations-store'
import { validateEpicContract, evaluateFactoryEligibility } from '@/lib/epic-contract'

export const dynamic = 'force-dynamic'

export async function GET() {
  const epics = await getEpics()
  return NextResponse.json(epics)
}

// POST: Epic Contract を検証して作成する。
//   - dryRun=true: 検証だけ行い、作成しない（import preview 用）。normalized と factory 対象判定を返す。
//   - dryRun 省略/false: 検証 OK なら epics.json に追記して作成（confirm import / フォーム送信）。
// 既存 Epic は破壊しない（追記のみ）。新しい正本は作らない。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const dryRun = body?.dryRun === true
  const payload = body?.epic ?? body

  const result = validateEpicContract(payload)
  if (!result.ok || !result.normalized) {
    return NextResponse.json(
      { ok: false, errors: result.errors, warnings: result.warnings },
      { status: dryRun ? 200 : 400 },
    )
  }

  // 作成前に Factory 対象判定をプレビュー（承認待ちは新規 Epic では 0）。
  const eligibility = evaluateFactoryEligibility(
    {
      goal: result.normalized.goal,
      doneCriteria: result.normalized.doneCriteria,
      decisionPolicy: result.normalized.decisionPolicy,
      priority: result.normalized.priority,
      riskFlags: result.normalized.riskFlags,
      factoryEligible: result.normalized.factoryEligible,
      status: 'active',
    },
    { pendingApprovalCount: 0 },
  )

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      errors: [],
      warnings: result.warnings,
      normalized: result.normalized,
      factoryEligibility: eligibility,
    })
  }

  const epic = await createEpic(result.normalized)
  return NextResponse.json({ ok: true, epic, warnings: result.warnings, factoryEligibility: eligibility })
}
