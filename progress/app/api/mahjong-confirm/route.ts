import { NextResponse } from 'next/server'
import { CONFIRM_ITEMS, readConfirmStore, saveAnswers } from '@/lib/mahjong-confirm'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// 【一時API】麻雀問題の未確定箇所。取り込み完了後に削除してよい。
export async function GET() {
  const store = await readConfirmStore()
  return NextResponse.json({ items: CONFIRM_ITEMS, ...store })
}

export async function POST(request: Request) {
  let body: { answers?: Array<{ itemId: string; value: string; freeText?: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: 'answers 配列が必要です' }, { status: 400 })
  }

  const store = await saveAnswers(body.answers)
  return NextResponse.json({ success: true, ...store })
}
