import { NextResponse } from 'next/server'
import { getIosBuildsOverview } from '@/lib/ios-builds'

export const dynamic = 'force-dynamic'

export async function GET() {
  const overview = await getIosBuildsOverview()
  return NextResponse.json(overview)
}
