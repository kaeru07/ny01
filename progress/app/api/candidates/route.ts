import { NextRequest, NextResponse } from 'next/server'
import { readWorkCandidates } from '@/lib/session-reader'
import { refreshCandidates, bulkApprove } from '@/lib/session-writer'

export async function GET() {
  try {
    const data = await readWorkCandidates()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Failed to read candidates:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await refreshCandidates()
    return NextResponse.json({ success: true, added: result.added })
  } catch (err) {
    console.error('Failed to refresh candidates:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    if (body.action === 'bulk_approve') {
      const ids: string[] = Array.isArray(body.ids) ? body.ids : []
      const result = await bulkApprove(ids)
      return NextResponse.json({ success: true, approved: result.approved })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('Failed to bulk approve candidates:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
