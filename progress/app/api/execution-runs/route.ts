import { NextResponse } from 'next/server'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { addExecutionRun } from '@/lib/execution-run-writer'
import { ensureExecutionRunNextActions } from '@/lib/execution-run-next-actions'
import { normalizeExecutionRunErrors } from '@/lib/execution-run-errors'
import { parseChangedFilesFromOutput } from '@/lib/executors/shell'
import { failingChecks, gateReviewStatusByChecks, gateRunStatusByChecks } from '@/lib/checks-gate'
import { getEpic, resolveEpicId, updateEpic } from '@/lib/operations-store'
import { shouldFinalizeEpicFromManualRun } from '@/lib/goal-completion-sync'
import { propagateEpicDoneToGoal } from '@/lib/factory-runner'
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

function mergeChangedFiles(explicit: ChangedFile[], rawReport: string): ChangedFile[] {
  const byFile = new Map<string, ChangedFile>()
  for (const item of explicit) {
    const file = item.file.trim()
    if (file) byFile.set(file, { ...item, file })
  }
  for (const file of parseChangedFilesFromOutput(rawReport)) {
    if (!byFile.has(file)) byFile.set(file, { file, change: 'rawReportから自動補完' })
  }
  return Array.from(byFile.values())
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

    // lint ゲート: API 経由の自己申告 Run も factory-runner と同じく、checks に NG が
    // あれば completed を partial へ格下げする（lint NG を完了扱いにしない）。
    const checks = normalizeChecks(body.checks)
    const ngChecks = failingChecks(checks)
    const runStatus = gateRunStatusByChecks(body.runStatus as RunStatus, checks)
    const gateWarnings = runStatus !== body.runStatus
      ? [`lintゲート: checks NG（${ngChecks.join(' / ')}）のため completed→partial に格下げ。要修正/レビュー待ち。`]
      : []

    const requestedReviewStatus: ReviewStatus = VALID_REVIEW_STATUSES.includes(body.reviewStatus)
      ? body.reviewStatus
      : 'not_reviewed'
    // 新規Run作成は必ずInboxレビューに残す。reviewed化はPATCH/AI一次レビュー/人間レビュー操作だけで行う。
    const normalizedReviewStatus: ReviewStatus = requestedReviewStatus === 'reviewed' ? 'not_reviewed' : requestedReviewStatus
    const reviewStatus: ReviewStatus = gateReviewStatusByChecks(normalizedReviewStatus, checks)

    const summary = String(body.summary).trim()
    const rawReport = String(body.rawReport).trim()
    const explicitChangedFiles: ChangedFile[] = Array.isArray(body.changedFiles)
      ? body.changedFiles.map(parseChangedFile)
      : []
    const changedFiles = mergeChangedFiles(explicitChangedFiles, rawReport)

    const targetApp = String(body.targetApp).trim()
    const targetTodoId = typeof body.targetTodoId === 'string' ? body.targetTodoId : undefined
    const explicitEpicId = typeof body.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined
    // epicId は明示優先。無ければ targetApp / targetTodoId から Epic を自動結合する。
    const epicId = await resolveEpicId({ epicId: explicitEpicId, targetApp, targetTodoId })

    // 手動戻しRunの完了後処理: doneCriteriaStatus='done' 明示 + completed + epicId 明示のときだけ、
    // factory-runner と同じ Epic done 化 + Goal/GoalTodo 同期を適用する（再キュー漏れの根本対策）。
    const doneCriteriaStatus: string | undefined =
      body.doneCriteriaStatus === 'done' || body.doneCriteriaStatus === 'continue'
        ? body.doneCriteriaStatus
        : undefined
    const finalizeEpic = explicitEpicId
      ? await getEpic(explicitEpicId).then((epic) => (
          epic && shouldFinalizeEpicFromManualRun({
            doneCriteriaStatus,
            runStatus,
            explicitEpicId,
            epicStatus: epic.status,
          })
            ? epic
            : null
        ))
      : null

    const errors = normalizeExecutionRunErrors(body.errors)
    const warnings = [...(Array.isArray(body.warnings) ? body.warnings : []), ...gateWarnings]
    const nextActions = ensureExecutionRunNextActions({
      nextActions: body.nextActions,
      rawReport,
      runStatus,
      summary,
      targetTodoTitle: String(body.targetTodoTitle).trim(),
      errors,
      warnings,
    })

    const run = {
      runId,
      startedAt: typeof body.startedAt === 'string' ? body.startedAt : now,
      finishedAt: typeof body.finishedAt === 'string' ? body.finishedAt : now,
      targetApp,
      epicId,
      targetTodoId,
      targetTodoTitle: String(body.targetTodoTitle).trim(),
      runStatus,
      reviewStatus,
      source: typeof body.source === 'string' && body.source.trim() ? body.source.trim() : undefined,
      executorUsed: VALID_EXECUTORS.includes(body.executorUsed) ? body.executorUsed : undefined,
      preferredExecutor: VALID_EXECUTORS.includes(body.preferredExecutor) ? body.preferredExecutor : undefined,
      fallbackExecutor: VALID_EXECUTORS.includes(body.fallbackExecutor) ? body.fallbackExecutor : undefined,
      autoFallback: typeof body.autoFallback === 'boolean' ? body.autoFallback : undefined,
      fallbackReason: typeof body.fallbackReason === 'string' ? body.fallbackReason : undefined,
      // Factory Dispatch メタ（任意・手動コピー運用の追跡用）。
      factoryDispatch: typeof body.factoryDispatch === 'boolean' ? body.factoryDispatch : undefined,
      dispatchMode: typeof body.dispatchMode === 'string' ? body.dispatchMode : undefined,
      dispatchPlanId: typeof body.dispatchPlanId === 'string' ? body.dispatchPlanId : undefined,
      executorCandidate: VALID_EXECUTORS.includes(body.executorCandidate) ? body.executorCandidate : undefined,
      promptGenerated: typeof body.promptGenerated === 'boolean' ? body.promptGenerated : undefined,
      resultReturned: typeof body.resultReturned === 'boolean' ? body.resultReturned : undefined,
      doneCriteriaStatus,
      stopReason: finalizeEpic
        ? 'epic_done（手動Run doneCriteriaStatus=done）'
        : gateWarnings.length > 0
          ? 'lint_gate_partial'
          : undefined,
      beforeStatus: typeof body.beforeStatus === 'string' ? body.beforeStatus : undefined,
      afterStatus: typeof body.afterStatus === 'string' ? body.afterStatus : undefined,
      promptUsed: typeof body.promptUsed === 'string' ? body.promptUsed : undefined,
      summary,
      changedFiles,
      checks,
      errors,
      warnings,
      progressUpdated: typeof body.progressUpdated === 'boolean' ? body.progressUpdated : false,
      nextActions,
      rawReport,
    }

    await addExecutionRun(run)

    // Run 保存後に Epic 完了後処理を適用する（失敗しても Run 登録は成功のまま返す）。
    let epicCompleted = false
    if (finalizeEpic) {
      try {
        await updateEpic(finalizeEpic.epicId, { status: 'done', progress: 100 })
        await propagateEpicDoneToGoal(finalizeEpic.epicId, finalizeEpic.goalId)
        epicCompleted = true
      } catch (err) {
        console.error(`Failed to finalize epic ${finalizeEpic.epicId} from manual run ${runId}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      runId,
      runStatus,
      ...(gateWarnings.length > 0 ? { lintGate: gateWarnings[0] } : {}),
      ...(finalizeEpic ? { epicCompleted } : {}),
    })
  } catch (err) {
    console.error('Failed to add execution run:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
