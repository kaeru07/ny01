import { NextResponse } from 'next/server'
import { getAutomationLog } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get('limit') ?? '20')
  return NextResponse.json(await getAutomationLog(Number.isFinite(limit) ? limit : 20))
}
