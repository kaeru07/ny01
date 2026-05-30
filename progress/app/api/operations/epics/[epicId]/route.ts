import { NextResponse } from 'next/server'
import { getEpicDetail } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: { epicId: string } },
) {
  const detail = await getEpicDetail(params.epicId)
  if (!detail) {
    return NextResponse.json({ error: 'epic not found' }, { status: 404 })
  }
  return NextResponse.json(detail)
}
