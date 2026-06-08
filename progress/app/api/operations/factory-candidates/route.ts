import { NextResponse } from 'next/server'
import { getAppFactoryCandidates } from '@/lib/app-factory-candidates'

export const dynamic = 'force-dynamic'

// GET: アプリ開発工場（epic-a5r7n4）の候補キューを返す読み取り専用ビュー（副作用なし）。
// 各アプリ案の 目的 / 収益化仮説 / 優先度 / 次アクション を一覧で確認するためのもの。
export async function GET() {
  const queue = await getAppFactoryCandidates()
  return NextResponse.json(queue)
}
