import { NextResponse } from 'next/server'
import { listInboxItems, getInboxRoot } from '@/lib/inbox-reader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await listInboxItems()
    return NextResponse.json(
      {
        inboxRoot: getInboxRoot(),
        total: items.length,
        pending: items.filter((i) => !i.imported).length,
        items,
      },
      { status: 200 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'inbox 読み込み失敗' },
      { status: 500 },
    )
  }
}
