import { NextRequest, NextResponse } from 'next/server'
import { addTask } from '@/lib/progress-writer'
import { findInboxItem, readInboxState, writeInboxState } from '@/lib/inbox-reader'
import type { NewTaskInput } from '@/types/progress'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const INBOX_PROJECT_ID = 'chatgpt-inbox'

export async function POST(req: NextRequest) {
  let body: { file?: unknown }
  try {
    body = (await req.json()) as { file?: unknown }
  } catch {
    return NextResponse.json({ error: 'JSON ボディが不正です' }, { status: 400 })
  }
  const file = typeof body.file === 'string' ? body.file.trim() : ''
  if (!file) {
    return NextResponse.json({ error: 'file は必須です' }, { status: 400 })
  }

  const item = await findInboxItem(file)
  if (!item) {
    return NextResponse.json({ error: `投函が見つかりません: ${file}` }, { status: 404 })
  }

  const state = await readInboxState()
  const dup = state.imported.find((r) => r.hash === item.hash)
  if (dup) {
    return NextResponse.json(
      {
        ok: false,
        alreadyImported: true,
        taskId: dup.taskId,
        message: 'この投函は取り込み済みです（冪等のためスキップ）',
      },
      { status: 200 },
    )
  }

  // ユーザー承認待ちで登録。Claude Code は pending_approval に着手しない運用。
  const input: NewTaskInput = {
    projectId: INBOX_PROJECT_ID,
    title: item.title,
    status: 'pending_approval',
    priority: 'medium',
    assignee: 'user',
    memo: `ChatGPT 投函取り込み (source=${item.source})\n${item.body}`.slice(0, 4000),
    doneCriteria: item.todoCandidates.length > 0 ? item.todoCandidates : undefined,
    targetPath: item.file,
  }

  let taskId: string
  try {
    taskId = await addTask(input)
  } catch (err) {
    return NextResponse.json(
      { error: `タスク追加に失敗: ${(err as Error).message}` },
      { status: 500 },
    )
  }

  const importedAt = new Date().toISOString()
  state.imported.push({
    file: item.file,
    hash: item.hash,
    taskId,
    projectId: INBOX_PROJECT_ID,
    importedAt,
  })
  await writeInboxState(state)

  return NextResponse.json(
    {
      ok: true,
      taskId,
      projectId: INBOX_PROJECT_ID,
      status: 'pending_approval',
      importedAt,
    },
    { status: 200 },
  )
}
