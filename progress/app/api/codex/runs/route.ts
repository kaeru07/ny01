import { NextRequest, NextResponse } from 'next/server'
import {
  checkCodexStatus,
  getActiveRun,
  runCodexExec,
  MAX_PROMPT_CHARS,
  MAX_TIMEOUT_MS,
} from '@/lib/codex-runner'
import { appendCodexRun, listCodexRuns } from '@/lib/codex-run-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 50, 1), 500) : 100
  const runs = await listCodexRuns(limit)
  return NextResponse.json({ runs }, { status: 200 })
}

type Body = {
  prompt?: unknown
  timeoutMs?: unknown
  sandbox?: unknown
  workingDir?: unknown
  targetTodoId?: unknown
  targetTodoTitle?: unknown
  queueItemId?: unknown
  projectId?: unknown
  projectName?: unknown
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'JSONボディが不正です' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ error: 'prompt は必須です' }, { status: 400 })
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return NextResponse.json(
      { error: `prompt が長すぎます (${prompt.length} > ${MAX_PROMPT_CHARS})` },
      { status: 400 },
    )
  }

  const active = getActiveRun()
  if (active) {
    return NextResponse.json(
      { error: `Codex は実行中です (${active.runId})。完了まで待ってください。` },
      { status: 409 },
    )
  }

  const status = await checkCodexStatus()
  if (!status.ok) {
    return NextResponse.json(
      { error: status.reason ?? 'codex CLI を利用できません', codexStatus: status },
      { status: 503 },
    )
  }

  const timeoutMs =
    typeof body.timeoutMs === 'number' && body.timeoutMs > 0
      ? Math.min(body.timeoutMs, MAX_TIMEOUT_MS)
      : undefined
  // 安全側: sandbox は read-only 固定。workspace-write は明示要求時のみ許可
  const sandbox = body.sandbox === 'workspace-write' ? 'workspace-write' : 'read-only'

  try {
    const { run } = await runCodexExec({
      prompt,
      timeoutMs,
      sandbox,
      workingDir: typeof body.workingDir === 'string' ? body.workingDir : undefined,
      targetTodoId: typeof body.targetTodoId === 'string' ? body.targetTodoId : undefined,
      targetTodoTitle:
        typeof body.targetTodoTitle === 'string' ? body.targetTodoTitle : undefined,
      queueItemId: typeof body.queueItemId === 'string' ? body.queueItemId : undefined,
      projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
      projectName: typeof body.projectName === 'string' ? body.projectName : undefined,
    })
    await appendCodexRun(run)
    return NextResponse.json({ ok: true, run }, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'codex 実行に失敗しました' },
      { status: 500 },
    )
  }
}
