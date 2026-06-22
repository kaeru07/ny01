import { NextResponse } from 'next/server'
import { readVerifyTodos, writeVerifyTodos, addTodo, type VerifyTodoInput } from '@/lib/verify-todos'

export const dynamic = 'force-dynamic'

// 動作確認Todo の一覧を返す。
export async function GET() {
  const registry = await readVerifyTodos()
  return NextResponse.json(registry)
}

// 動作確認Todo を新規追加する。
export async function POST(request: Request) {
  let body: VerifyTodoInput
  try {
    body = (await request.json()) as VerifyTodoInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  if (!body.appName?.trim() && !body.url?.trim() && !body.steps?.trim()) {
    return NextResponse.json(
      { error: 'appName / url / steps のいずれか1つは必須です' },
      { status: 400 },
    )
  }

  const registry = await readVerifyTodos()
  const { registry: next, todo } = addTodo(registry, body)
  await writeVerifyTodos(next)
  return NextResponse.json({ success: true, todo })
}
