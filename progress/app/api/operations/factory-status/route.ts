import { NextResponse } from 'next/server'
import { computeFactoryStatus } from '@/lib/factory-status'

export const dynamic = 'force-dynamic'

// GET: Factory 進行状況（状態中心の派生ビュー）。副作用なし。
export async function GET() {
  const status = await computeFactoryStatus()
  return NextResponse.json(status)
}
