import { NextResponse } from 'next/server'
import {
  appendQuestion, updateQuestion, getQuestionForEdit, listQuestions,
  countQuestions, TILE_GROUPS, SEATS, SEAT_LABEL, type BuilderInput,
} from '@/lib/mahjong-builder'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET: 入力候補 + 現在の問題数。
//   ?list=1 で既存問題の一覧、 ?id=qNNN で1問を編集フォーム用に取得。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const wantList = url.searchParams.get('list')

  try {
    if (id) {
      return NextResponse.json({ question: await getQuestionForEdit(id) })
    }
    if (wantList) {
      return NextResponse.json({ questions: await listQuestions() })
    }
    return NextResponse.json({
      tileGroups: TILE_GROUPS,
      seats: SEATS.map((s) => ({ key: s, label: SEAT_LABEL[s] })),
      total: await countQuestions(),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 400 })
  }
}

// POST: 新規追加
export async function POST(request: Request) {
  let body: BuilderInput
  try {
    body = (await request.json()) as BuilderInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  try {
    return NextResponse.json({ success: true, ...(await appendQuestion(body)) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'save failed' }, { status: 400 })
  }
}

// PUT: 既存問題を上書き更新（?id=qNNN）
export async function PUT(request: Request) {
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id が必要です' }, { status: 400 })
  let body: BuilderInput
  try {
    body = (await request.json()) as BuilderInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }
  try {
    return NextResponse.json({ success: true, ...(await updateQuestion(id, body)) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'update failed' }, { status: 400 })
  }
}
