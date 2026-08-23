import { NextResponse } from 'next/server'
import {
  buildKnownAppsBrief,
  buildRows,
  filterRows,
  readMarketResearch,
  sortRows,
  upsertMarketApps,
  type MarketFilter,
  type MarketResearchInput,
  type MarketSortKey,
} from '@/lib/app-market-research'

export const dynamic = 'force-dynamic'

// 調査済みアプリの一覧。?sort= と各種フィルタに対応する。
// ?brief=1 で「既出アプリ一覧」テキストだけ返す（調査プロンプトが重複防止に使う）。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const store = await readMarketResearch()

  if (params.get('brief') === '1') {
    return NextResponse.json({ knownApps: buildKnownAppsBrief(store), count: store.apps.length })
  }

  const filter: MarketFilter = {
    hitType: (params.get('hitType') as MarketFilter['hitType']) ?? undefined,
    developerScale: (params.get('developerScale') as MarketFilter['developerScale']) ?? undefined,
    monetization: (params.get('monetization') as MarketFilter['monetization']) ?? undefined,
    category: params.get('category') ?? undefined,
    verdict: (params.get('verdict') as MarketFilter['verdict']) ?? undefined,
    minReproducibility: params.get('minReproducibility') ? Number(params.get('minReproducibility')) : undefined,
    q: params.get('q') ?? undefined,
  }
  const sort = (params.get('sort') as MarketSortKey) ?? 'value'
  const rows = sortRows(filterRows(buildRows(store), filter), sort)

  return NextResponse.json({ updatedAt: store.updatedAt, total: store.apps.length, rows })
}

// 調査結果の保存。同じアプリは行を増やさずスナップショットを足す。
export async function POST(request: Request) {
  let body: { apps?: unknown } | MarketResearchInput[]
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON の形式が不正です' }, { status: 400 })
  }

  const inputs = Array.isArray(body) ? body : Array.isArray(body?.apps) ? (body.apps as MarketResearchInput[]) : null
  if (!inputs) return NextResponse.json({ error: 'apps 配列が必要です' }, { status: 400 })

  try {
    const results = await upsertMarketApps(inputs)
    return NextResponse.json({
      success: true,
      results,
      newCount: results.filter((item) => item.mode === 'new').length,
      updatedCount: results.filter((item) => item.mode === 'updated').length,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
