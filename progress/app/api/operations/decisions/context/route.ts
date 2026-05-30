import { NextResponse } from 'next/server'
import { buildDecisionContext } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Number(url.searchParams.get('limit') ?? 20)
  const context = await buildDecisionContext(Number.isFinite(limit) ? limit : 20)
  return NextResponse.json(context)
}
