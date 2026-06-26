import { getAutomationConfig } from '@/lib/operations-store'
import { routesToApprovalQueue } from '@/lib/executor-roles'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { addExecutionRun, updateReviewStatus } from '@/lib/execution-run-writer'
import { getAdapter } from '@/lib/executors'
import type { ExecutorResult, FactoryRunMode } from '@/lib/executors/types'
import type { ExecutionRun } from '@/types/execution-run'

interface ReviewFixDispatchOptions {
  mode?: FactoryRunMode
  confirm?: boolean
  maxItems?: number
  cwd?: string
}

export interface ReviewFixDispatchStep {
  runId: string
  title: string
  status: 'reserved' | 'completed' | 'failed' | 'blocked'
  followupRunId?: string
  reason: string
}

export interface ReviewFixDispatchReport {
  mode: FactoryRunMode
  startedAt: string
  finishedAt: string
  maxItems: number
  considered: number
  executed: number
  skipped: number
  blocked: number
  reserved: number
  steps: ReviewFixDispatchStep[]
  stoppedReason: string
}

function generateRunId(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${String(now.getMilliseconds()).padStart(3, '0')}`
}

async function generateUniqueRunId(): Promise<string> {
  const existing = new Set((await readExecutionRuns()).map((run) => run.runId))
  const base = generateRunId()
  if (!existing.has(base)) return base
  let i = 1
  while (existing.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

function isConsumedFixRun(run: ExecutionRun): boolean {
  return run.source === 'review_fix'
    && run.dispatchMode === 'auto'
    && (run.runStatus === 'completed' || run.runStatus === 'partial')
    && Boolean(run.followupOfRunId)
}

function pickTargets(runs: ExecutionRun[], maxItems: number): ExecutionRun[] {
  const consumed = new Set(runs.filter(isConsumedFixRun).map((run) => run.followupOfRunId).filter(Boolean))
  return runs
    .filter((run) => run.reviewStatus === 'needs_followup')
    .filter((run) => typeof run.fixPrompt === 'string' && run.fixPrompt.trim().length > 0)
    .filter((run) => !consumed.has(run.runId))
    .sort((a, b) => Date.parse(a.fixRequestedAt ?? a.reviewedAt ?? a.finishedAt ?? a.startedAt) - Date.parse(b.fixRequestedAt ?? b.reviewedAt ?? b.finishedAt ?? b.startedAt))
    .slice(0, maxItems)
}

function safetyBlockReason(run: ExecutionRun): string | null {
  // 危険操作の自動実行ブロック判定は executor-roles.ts の正本ヘルパーに集約。
  // （旧 HARD_DENY_PATTERN + classifyCodexEligibility の二重判定と同一挙動）
  const text = `${run.targetTodoTitle} ${run.fixPrompt ?? ''}`
  return routesToApprovalQueue(text).reason
}

function buildDispatchPrompt(run: ExecutionRun): string {
  return [
    'あなたは Progress のレビュー修正依頼から呼ばれた作業エージェントです。人間が入力した修正指示を最優先で実施してください。',
    '',
    '[1] 元作業',
    `元Run ID: ${run.runId}`,
    `元タイトル: ${run.targetTodoTitle}`,
    `targetApp: ${run.targetApp}`,
    run.epicId ? `Epic ID: ${run.epicId}` : '',
    run.summary ? `元作業 summary: ${run.summary}` : '',
    '',
    '[2] 人間の修正指示（最優先）',
    run.fixPrompt ?? '',
    '',
    '[3] 禁止事項',
    '- 認証・課金・本番反映・deploy・secret・.env・migration・破壊的削除は実行しない。',
    '- 指示範囲外の大規模リファクタをしない。',
    '- 自動で外部公開、本番反映、課金設定、認証情報変更をしない。',
    '- 判断が必要な場合は作業を止め、結果に理由を残す。',
    '',
    '[4] 完了時',
    '- 修正内容、検証結果、未対応点を簡潔に報告する。',
  ].filter(Boolean).join('\n')
}

function dryRunResult(): ExecutorResult {
  return {
    status: 'needs_manual',
    stdout: '[dry-run] Review fix dispatch prompt generated. Adapter was not started.',
    stderr: '',
    resultSummary: '[dry-run] レビュー修正依頼の実起動なし。次回 auto+confirm で最優先実行予定',
    changedFiles: [],
    rateLimited: false,
    needsApproval: false,
    nextActions: [],
  }
}

async function recordReviewFixRun(args: {
  original: ExecutionRun
  mode: FactoryRunMode
  prompt: string
  result: ExecutorResult
}): Promise<string> {
  const runId = await generateUniqueRunId()
  const now = new Date().toISOString()
  const runStatusMap: Record<ExecutorResult['status'], ExecutionRun['runStatus']> = {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    needs_manual: 'partial',
  }
  const run: ExecutionRun = {
    runId,
    startedAt: now,
    finishedAt: now,
    targetApp: args.original.targetApp,
    epicId: args.original.epicId,
    targetTodoId: args.original.targetTodoId,
    targetTodoTitle: `修正依頼: ${args.original.targetTodoTitle}`,
    runStatus: runStatusMap[args.result.status],
    reviewStatus: 'not_reviewed',
    source: 'review_fix',
    followupOfRunId: args.original.runId,
    executorUsed: 'claude',
    factoryRun: true,
    runnerMode: args.mode,
    factoryDispatch: true,
    dispatchMode: args.mode === 'auto' ? 'auto' : 'manual_copy',
    dispatchPlanId: `review-fix:${args.original.runId}`,
    executorCandidate: 'claude',
    promptGenerated: true,
    resultReturned: args.mode === 'auto',
    promptUsed: args.prompt,
    summary: args.result.resultSummary,
    changedFiles: args.result.changedFiles.map((file) => ({ file, change: '' })),
    checks: {},
    errors: args.result.stderr ? [args.result.stderr.slice(0, 500)] : [],
    warnings: [],
    progressUpdated: false,
    nextActions: args.result.nextActions,
    rawReport: `[review-fix ${args.mode}] followupOfRunId=${args.original.runId}\n${args.result.stdout || args.result.resultSummary}`,
  }
  await addExecutionRun(run)
  return runId
}

export async function runReviewFixDispatch(opts: ReviewFixDispatchOptions = {}): Promise<ReviewFixDispatchReport> {
  const mode = opts.mode ?? 'dry_run'
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? 1, 2))
  const startedAt = new Date().toISOString()
  const steps: ReviewFixDispatchStep[] = []
  let considered = 0
  let executed = 0
  let skipped = 0
  let blocked = 0
  let reserved = 0

  const config = await getAutomationConfig()
  if (!config.factoryEnabled) return finalize('factory_off')

  const runs = await readExecutionRuns()
  const targets = pickTargets(runs, maxItems)
  considered = targets.length
  if (targets.length === 0) return finalize('no_candidate')

  for (const original of targets) {
    const blockReason = safetyBlockReason(original)
    if (blockReason) {
      blocked += 1
      const message = `${blockReason}。危険シグナルのため自動実行不可・人手対応してください。`
      await updateReviewStatus(original.runId, 'needs_followup', {
        reviewMemo: [original.reviewMemo, message].filter(Boolean).join('\n'),
      })
      steps.push({ runId: original.runId, title: original.targetTodoTitle, status: 'blocked', reason: message })
      continue
    }

    const prompt = buildDispatchPrompt(original)
    if (mode !== 'auto' || !opts.confirm) {
      const result = dryRunResult()
      const followupRunId = await recordReviewFixRun({ original, mode, prompt, result })
      reserved += 1
      steps.push({ runId: original.runId, title: original.targetTodoTitle, status: 'reserved', followupRunId, reason: 'dry_run のため実起動せず記録のみ行いました' })
      continue
    }

    try {
      const result = await getAdapter('claude').run({
        epicId: original.epicId ?? `review-fix:${original.runId}`,
        prompt,
        cwd: opts.cwd,
        dryRun: false,
        safetyText: `${original.targetTodoTitle} ${original.fixPrompt ?? ''}`,
      })
      const followupRunId = await recordReviewFixRun({ original, mode, prompt, result })
      if (result.status === 'completed' || result.status === 'partial') {
        await updateReviewStatus(original.runId, 'reviewed', {
          reviewMemo: [original.reviewMemo, `修正依頼を自動実行: ${followupRunId}`].filter(Boolean).join('\n'),
        })
        executed += 1
        steps.push({ runId: original.runId, title: original.targetTodoTitle, status: 'completed', followupRunId, reason: result.resultSummary })
      } else {
        skipped += 1
        steps.push({ runId: original.runId, title: original.targetTodoTitle, status: 'failed', followupRunId, reason: result.resultSummary })
      }
    } catch (error) {
      skipped += 1
      const message = error instanceof Error ? error.message : 'Review fix adapter failed'
      steps.push({ runId: original.runId, title: original.targetTodoTitle, status: 'failed', reason: message })
    }
  }

  return finalize('completed')

  function finalize(stoppedReason: string): ReviewFixDispatchReport {
    return {
      mode,
      startedAt,
      finishedAt: new Date().toISOString(),
      maxItems,
      considered,
      executed,
      skipped,
      blocked,
      reserved,
      steps,
      stoppedReason,
    }
  }
}
