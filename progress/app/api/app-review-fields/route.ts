import { NextResponse } from 'next/server'
import { getAppReviewFields, saveAppReviewFields } from '@/lib/app-review-fields'

export const dynamic = 'force-dynamic'

// 審査提出準備の入力値（保存値マージ済み）を返す。
export async function GET() {
  const apps = await getAppReviewFields()
  return NextResponse.json({ apps })
}

// 1アプリ分の入力値を保存する。空文字の項目は自動既定値へ戻す。
export async function PUT(request: Request) {
  let body: { bundleId?: unknown; fields?: unknown }
  try {
    body = (await request.json()) as { bundleId?: unknown; fields?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON の形式が不正です' }, { status: 400 })
  }

  if (typeof body.bundleId !== 'string' || !body.bundleId.trim()) {
    return NextResponse.json({ error: 'bundleId は必須です' }, { status: 400 })
  }

  try {
    const app = await saveAppReviewFields(body.bundleId, (body.fields ?? {}) as Record<string, unknown>)
    return NextResponse.json({ success: true, app })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
