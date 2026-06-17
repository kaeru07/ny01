import { NextResponse } from 'next/server'
import { appendUsageEvent } from '@/lib/usage-store'

export const dynamic = 'force-dynamic'

// progress 自身の使用イベント（画面遷移 / ボタン操作）を1件記録する。
// UsageTracker（layout 常駐）から navigator.sendBeacon / fetch で呼ばれる軽量エンドポイント。
export async function POST(request: Request) {
  let body: { type?: string; path?: string; label?: string }
  try {
    body = (await request.json()) as { type?: string; path?: string; label?: string }
  } catch {
    return NextResponse.json({ success: false, error: 'invalid json body' }, { status: 400 })
  }

  if (typeof body?.type !== 'string') {
    return NextResponse.json({ success: false, error: 'type required' }, { status: 400 })
  }

  try {
    await appendUsageEvent({ type: body.type, path: body.path, label: body.label })
  } catch {
    return NextResponse.json({ success: false, error: 'append failed' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
