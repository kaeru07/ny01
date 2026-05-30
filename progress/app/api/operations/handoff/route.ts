import { NextResponse } from 'next/server'
import { generateHandoffView } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const epicId = new URL(request.url).searchParams.get('epicId') ?? undefined
  const handoff = await generateHandoffView(epicId)
  return NextResponse.json(handoff)
}
