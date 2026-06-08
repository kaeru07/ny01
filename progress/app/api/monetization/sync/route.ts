import { NextResponse } from 'next/server'
import { syncCandidatesFromVault } from '@/lib/monetization-vault-sync'

export const dynamic = 'force-dynamic'

// POST: Vault の調査結果を走査して収益化候補を取り込む（定期実行 11:00/23:00/boot の同期ステップ / 手動テスト）。
// 候補の追加・調査元追記のみ。Epic化・公開・課金・deploy・secret には触れない。
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const result = await syncCandidatesFromVault({ source: body?.source, trigger: body?.trigger })
  return NextResponse.json(result)
}
