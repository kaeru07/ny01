import { NextResponse } from 'next/server'
import { getEpics } from '@/lib/operations-store'

export async function GET() {
  const epics = await getEpics()
  return NextResponse.json(epics)
}
