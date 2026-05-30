import { NextResponse } from 'next/server'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { addExecutionRun } from '@/lib/execution-run-writer'
import type { ExecutorType, RunStatus, ReviewStatus, ChangedFile } from '@/types/execution-run'

const VALID_RUN_STATUSES: RunStatus[] = ['running', 'completed', 'failed', 'partial']
const VALID_REVIEW_STATUSES: ReviewStatus[] = ['not_reviewed', 'copied', 'reviewed', 'needs_followup']
const VALID_EXECUTORS: ExecutorType[] = ['claude', 'codex', 'manual', 'other']

function generateRunId(): string {
  const now = new Date()
  const pad = (n: number, d = 2) => String(n).padStart(d, '0')
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('')
}

function parseChangedFile(f: unknown): ChangedFile {
  if (typeof f === 'string') return { file: f, change: '' }
  if (typeof f === 'object' && f !== null) {
    const obj = f as Record<string, unknown>
    // accept both {file, change} and {path, action} formats
    const file = obj.file ?? obj.path ?? ''
    const change = obj.change ?? obj.action ?? ''
    return {
      file: typeof file === 'string' ? file : String(file),
      change: typeof change === 'string' ? change : String(change),
    }
  }
  return { file: String(f), change: '' }
}

function normalizeChecks(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {}
  const obj = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  // copy existing string fields as-is
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') {
      out[k] = v
    } else if (typeof v === 'boolean') {
      // map boolean *Passed / *Started / *Checked fields to canonical names
      const ok = v ? 'OK' : 'NG'
      if (k === 'buildPassed') out.build = ok
      else if (k === 'typeCheckPassed') out.typescript = ok
      else if (k === 'lintPassed') out.lint = ok
      else if (k === 'devStarted') out.mainScreen = ok
      else if (k === 'apiChecked') out.api = ok
      else if (k === 'uiChecked') out.mobileLayout = ok
      else out[k] = ok
    }
  }
  return out
}

export async function GET() {
  try {
    const runs = await readExecutionRuns()
    return NextResponse.json({ runs })
  } catch (err) {
    console.error('Failed to read execution runs:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Required fields
    if (!body.targetApp || typeof body.targetApp !== 'string') {
      return NextResponse.json({ error: 'targetApp is required' }, { status: 400 })
    }
    if (!body.targetTodoTitle || typeof body.targetTodoTitle !== 'string') {
      return NextResponse.json({ error: 'targetTodoTitle is required' }, { status: 400 })
    }
    if (!body.runStatus || !VALID_RUN_STATUSES.includes(body.runStatus)) {
      return NextResponse.json(
        { error: `runStatus must be one of: ${VALID_RUN_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }
    if (!body.summary || typeof body.summary !== 'string') {
      return NextResponse.json({ error: 'summary is required' }, { status: 400 })
    }
    if (!body.rawReport || typeof body.rawReport !== 'string') {
      return NextResponse.json({ error: 'rawReport is required' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const runId: string = typeof body.runId === 'string' && body.runId.trim()
      ? body.runId.trim()
      : generateRunId()

    const reviewStatus: ReviewStatus = VALID_REVIEW_STATUSES.includes(body.reviewStatus)
      ? body.reviewStatus
      : 'not_reviewed'

    const changedFiles: ChangedFile[] = Array.isArray(body.changedFiles)
      ? body.changedFiles.map(parseChangedFile)
      : []

    const run = {
      runId,
      startedAt: typeof body.startedAt === 'string' ? body.startedAt : now,
      finishedAt: typeof body.finishedAt === 'string' ? body.finishedAt : now,
      targetApp: String(body.targetApp).trim(),
      epicId: typeof body.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined,
      targetTodoId: typeof body.targetTodoId === 'string' ? body.targetTodoId : undefined,
      targetTodoTitle: String(body.targetTodoTitle).trim(),
      runStatus: body.runStatus as RunStatus,
      reviewStatus,
      executorUsed: VALID_EXECUTORS.includes(body.executorUsed) ? body.executorUsed : undefined,
      preferredExecutor: VALID_EXECUTORS.includes(body.preferredExecutor) ? body.preferredExecutor : undefined,
      fallbackExecutor: VALID_EXECUTORS.includes(body.fallbackExecutor) ? body.fallbackExecutor : undefined,
      autoFallback: typeof body.autoFallback === 'boolean' ? body.autoFallback : undefined,
      fallbackReason: typeof body.fallbackReason === 'string' ? body.fallbackReason : undefined,
      beforeStatus: typeof body.beforeStatus === 'string' ? body.beforeStatus : undefined,
      afterStatus: typeof body.afterStatus === 'string' ? body.afterStatus : undefined,
      promptUsed: typeof body.promptUsed === 'string' ? body.promptUsed : undefined,
      summary: String(body.summary).trim(),
      changedFiles,
      checks: normalizeChecks(body.checks),
      errors: Array.isArray(body.errors) ? body.errors : [],
      warnings: Array.isArray(body.warnings) ? body.warnings : [],
      progressUpdated: typeof body.progressUpdated === 'boolean' ? body.progressUpdated : false,
      nextActions: Array.isArray(body.nextActions) ? body.nextActions : [],
      rawReport: String(body.rawReport).trim(),
    }

    await addExecutionRun(run)
    return NextResponse.json({ success: true, runId })
  } catch (err) {
    console.error('Failed to add execution run:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
