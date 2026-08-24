import { classifyCodexEligibility, getAutomationConfig } from '@/lib/operations-store'
import { addExecutionRun } from '@/lib/execution-run-writer'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { ensureExecutionRunNextActions } from '@/lib/execution-run-next-actions'
import { buildPromptQueueView, updatePromptQueueItem } from '@/lib/prompt-queue'
import { getAdapter } from '@/lib/executors'
import { decideCodexFallback } from '@/lib/executor-fallback'
import type { ExecutorResult, FactoryRunMode } from '@/lib/executors/types'
import type { ExecutorChoice } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import type { PromptQueueCandidate } from '@/types/prompt-queue'
import { classifyNoOpRun } from './no-op-run'

interface PromptQueueDispatchOptions {
  mode?: FactoryRunMode
  confirm?: boolean
  maxItems?: number
  cwd?: string
}

export interface PromptQueueDispatchStep {
  itemId: string
  title: string
  status: 'reserved' | 'completed' | 'failed' | 'blocked' | 'skipped'
  runId?: string
  reason: string
}

export interface PromptQueueDispatchReport {
  mode: FactoryRunMode
  startedAt: string
  finishedAt: string
  maxItems: number
  considered: number
  executed: number
  skipped: number
  blocked: number
  reserved: number
  steps: PromptQueueDispatchStep[]
  stoppedReason: string
}

// 英単語は前後を単語境界で挟む。挟まないと company の `secretary/` が 'secret' に、
// `production` を含まない `reproduction` 等が誤って危険判定になる（2026-08-23 修正）。
// 日本語はスペースで区切られないため、そのまま部分一致で見る。
const HARD_DENY_PATTERN =
  /課金|デプロイ|本番|認証|マイグレーション|削除|\.env|\b(?:billing|deploy|production|secret|secrets|migration|destructive|force)\b/i

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

function safetyBlockReason(item: PromptQueueCandidate): string | null {
  const text = `${item.title} ${item.prompt}`
  const hard = text.match(HARD_DENY_PATTERN)?.[0]
  if (hard) return `危険シグナル「${hard}」を含むため自動実行不可`
  const verdict = classifyCodexEligibility(text)
  if (!verdict.eligible && verdict.reason.includes('危険シグナル')) {
    return `${verdict.reason}。自動実行不可`
  }
  return null
}

function buildDispatchPrompt(item: PromptQueueCandidate): string {
  return [
    'あなたは Progress の Prompt Queue から呼ばれた作業エージェントです。以下の作業プロンプトだけを実施してください。',
    '',
    '[1] 対象',
    `タスク名: ${item.title}`,
    `Project: ${item.projectName ?? item.projectId ?? '未紐付け'}`,
    `Goal進捗: ${item.goalProgressTitle ?? item.goalProgressId ?? '未紐付け'}`,
    item.relatedInboxId ? `関連Inbox ID: ${item.relatedInboxId}` : '',
    item.relatedReviewId ? `関連レビューID: ${item.relatedReviewId}` : '',
    item.relatedUrl ? `関連URL: ${item.relatedUrl}` : '',
    '',
    '[2] 作業プロンプト',
    item.prompt,
    '',
    '[3] 禁止事項',
    '- 認証・課金・本番反映・deploy・secret・.env・migration・破壊的削除は実行しない。',
    '- 指示範囲外の大規模リファクタをしない。',
    '- 自動で外部公開、本番反映、課金設定、認証情報変更をしない。',
    '- 判断が必要な場合は作業を止め、結果に理由を残す。',
    '',
    '[4] 完了時',
    '- 変更内容、検証結果、未対応点を簡潔に報告する。',
  ].filter(Boolean).join('\n')
}

async function recordPromptQueueRun(args: {
  item: PromptQueueCandidate
  mode: FactoryRunMode
  prompt: string
  result: ExecutorResult
  executor: ExecutorChoice
  fallbackReason?: string
}): Promise<string> {
  const runId = await generateUniqueRunId()
  const now = new Date().toISOString()
  const runStatusMap: Record<ExecutorResult['status'], ExecutionRun['runStatus']> = {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    needs_manual: 'partial',
  }
  const noOp = classifyNoOpRun(args.result)
  // 空振り（変更0かつ出力なし）は completed にしない。回った回数と成果を一致させるため。
  const runStatus = noOp.isNoOp ? 'partial' : runStatusMap[args.result.status]
  const rawReport = `[prompt-queue ${args.mode}] item=${args.item.id} executor=${args.executor}\n${args.result.stdout || args.result.resultSummary}`
  const errors = args.result.stderr ? [args.result.stderr.slice(0, 500)] : []
  const warnings: string[] = noOp.isNoOp ? [`空振り: ${noOp.reason}。完了扱いにせず再実行対象にした`] : []
  const nextActions = ensureExecutionRunNextActions({
    nextActions: args.result.nextActions,
    rawReport,
    runStatus,
    summary: args.result.resultSummary,
    targetTodoTitle: args.item.title,
    errors,
    warnings,
  })
  const run: ExecutionRun = {
    runId,
    startedAt: now,
    finishedAt: now,
    targetApp: args.item.projectName ?? args.item.projectId ?? 'prompt-queue',
    targetTodoTitle: args.item.title,
    runStatus,
    reviewStatus: 'not_reviewed',
    source: 'prompt_queue',
    executorUsed: args.executor,
    factoryRun: true,
    runnerMode: args.mode,
    factoryDispatch: true,
    dispatchMode: args.mode === 'auto' ? 'auto' : 'manual_copy',
    dispatchPlanId: `prompt-queue:${args.item.id}`,
    executorCandidate: args.executor,
    promptGenerated: true,
    resultReturned: args.mode === 'auto',
    fallbackReason: args.fallbackReason,
    promptUsed: args.prompt,
    nextActionCount: nextActions.length,
    summary: args.result.resultSummary,
    changedFiles: args.result.changedFiles.map((file) => ({ file, change: '' })),
    checks: {},
    errors,
    warnings,
    progressUpdated: false,
    nextActions,
    rawReport,
  }
  await addExecutionRun(run)
  return runId
}

function dryRunResult(): ExecutorResult {
  return {
    status: 'needs_manual',
    stdout: '[dry-run] Prompt Queue dispatch prompt generated. Adapter was not started.',
    stderr: '',
    resultSummary: '[dry-run] Prompt Queue 実起動なし。次回 auto+confirm で実行予約済み',
    changedFiles: [],
    rateLimited: false,
    needsApproval: false,
    nextActions: ['auto+confirm でPrompt Queue作業を実行し、結果のExecutionRunを確認する'],
  }
}

export async function runPromptQueueDispatch(opts: PromptQueueDispatchOptions = {}): Promise<PromptQueueDispatchReport> {
  const mode = opts.mode ?? 'dry_run'
  const maxItems = Math.max(1, Math.min(opts.maxItems ?? 1, 2))
  const startedAt = new Date().toISOString()
  const steps: PromptQueueDispatchStep[] = []
  let executed = 0
  let skipped = 0
  let blocked = 0
  let reserved = 0
  let considered = 0
  let stoppedReason = 'completed'

  const config = await getAutomationConfig()
  if (!config.factoryEnabled) return finalize('factory_off')

  const view = await buildPromptQueueView()
  const candidates = view.nextCandidates.slice(0, maxItems)
  considered = candidates.length
  if (candidates.length === 0) return finalize('no_candidate')

  for (const item of candidates) {
    const blockReason = safetyBlockReason(item)
    if (blockReason) {
      blocked += 1
      const message = `${blockReason}。人手で確認/分割してください。`
      await updatePromptQueueItem(item.id, { status: 'needs_user_prompt_fix', errorMessage: message })
      steps.push({ itemId: item.id, title: item.title, status: 'blocked', reason: message })
      continue
    }

    const prompt = buildDispatchPrompt(item)
    await updatePromptQueueItem(item.id, { status: 'running' })

    if (mode !== 'auto' || !opts.confirm) {
      const result = dryRunResult()
      const runId = await recordPromptQueueRun({ item, mode, prompt, result, executor: 'manual' })
      await updatePromptQueueItem(item.id, {
        status: 'reserved',
        executionRunId: runId,
        resultSummary: result.resultSummary,
      })
      reserved += 1
      steps.push({ itemId: item.id, title: item.title, status: 'reserved', runId, reason: 'dry_run のため実起動せず予約状態にしました' })
      continue
    }

    try {
      let executor: ExecutorChoice = 'claude'
      let fallbackReason: string | undefined
      let result = await getAdapter(executor).run({
        epicId: `prompt-queue:${item.id}`,
        prompt,
        cwd: opts.cwd,
        dryRun: false,
        safetyText: `${item.title} ${item.prompt}`,
      })
      const fallback = decideCodexFallback({
        attemptedExecutor: executor,
        result,
        autoFallback: config.autoFallback,
        executorMode: config.executorMode,
        canRunOnCodex: true,
      })
      if (fallback.shouldFallback) {
        result = await getAdapter('codex').run({
          epicId: `prompt-queue:${item.id}`,
          prompt,
          cwd: opts.cwd,
          dryRun: false,
          safetyText: `${item.title} ${item.prompt}`,
        })
        executor = 'codex'
        fallbackReason = fallback.reason
      }
      const runId = await recordPromptQueueRun({ item, mode, prompt, result, executor, fallbackReason })
      const noOp = classifyNoOpRun(result)
      if (noOp.isNoOp) {
        // 実質何もしていない Run で作業予約を閉じない。次回の自動実行で再試行する。
        await updatePromptQueueItem(item.id, {
          status: 'needs_retry',
          executionRunId: runId,
          resultSummary: result.resultSummary,
          errorMessage: `空振り: ${noOp.reason}`,
        })
        skipped += 1
        steps.push({ itemId: item.id, title: item.title, status: 'skipped', runId, reason: `空振り: ${noOp.reason}` })
      } else if (result.status === 'completed' || result.status === 'partial') {
        await updatePromptQueueItem(item.id, {
          status: 'completed',
          executionRunId: runId,
          resultSummary: result.resultSummary,
        })
        executed += 1
        steps.push({ itemId: item.id, title: item.title, status: 'completed', runId, reason: result.resultSummary })
      } else {
        await updatePromptQueueItem(item.id, {
          status: result.rateLimited ? 'needs_retry' : 'failed',
          executionRunId: runId,
          resultSummary: result.resultSummary,
          errorMessage: result.stderr || result.errorType || result.resultSummary,
        })
        skipped += 1
        steps.push({ itemId: item.id, title: item.title, status: 'failed', runId, reason: result.resultSummary })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prompt Queue adapter failed'
      await updatePromptQueueItem(item.id, { status: 'failed', errorMessage: message })
      skipped += 1
      steps.push({ itemId: item.id, title: item.title, status: 'failed', reason: message })
    }
  }

  return finalize(stoppedReason)

  function finalize(reason: string): PromptQueueDispatchReport {
    stoppedReason = reason
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
