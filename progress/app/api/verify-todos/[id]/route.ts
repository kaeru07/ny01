import { NextResponse } from 'next/server'
import { readVerifyTodos, writeVerifyTodos, updateTodo, deleteTodo, type VerifyTodoInput } from '@/lib/verify-todos'

export const dynamic = 'force-dynamic'

// 既存の動作確認Todo を部分更新する（状態変更・内容修正）。
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  let body: VerifyTodoInput
  try {
    body = (await request.json()) as VerifyTodoInput
  } catch {
    return NextResponse.json({ error: 'invalid json body' }, { status: 400 })
  }

  const registry = await readVerifyTodos()
  const result = updateTodo(registry, params.id, body)
  if (!result) {
    return NextResponse.json({ error: `todo not found: ${params.id}` }, { status: 404 })
  }
  await writeVerifyTodos(result.registry)
  return NextResponse.json({ success: true, todo: result.todo })
}

// 動作確認Todo を削除する。
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const registry = await readVerifyTodos()
  const { registry: next, removed } = deleteTodo(registry, params.id)
  if (!removed) {
    return NextResponse.json({ error: `todo not found: ${params.id}` }, { status: 404 })
  }
  await writeVerifyTodos(next)
  return NextResponse.json({ success: true })
}
