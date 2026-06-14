import { classifyCodexEligibility, getAutomationConfig } from '@/lib/operations-store'
import { computeFactoryStatus } from '@/lib/factory-status'
import { addExecutionRun } from '@/lib/execution-run-writer'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { buildPromptQueueView, updatePromptQueueItem } from '@/lib/prompt-queue'
import { getAdapter } from '@/lib/executors'
import type { ExecutorResult, FactoryRunMode } from '@/lib/executors/types'
import type { ExecutionRun } from '@/types/execution-run'
import type { PromptQueueCandidate } from '@/types/prompt-queue'

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

const HARD_DENY_PATTERN = /課金|billing|deploy|デプロイ|本番|production|secret|\.env|認証|migration|マイグレーション|削除|destructive|force/i

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
    targetApp: args.item.projectName ?? args.item.projectId ?? 'prompt-queue',
    targetTodoTitle: args.item.title,
    runStatus: runStatusMap[args.result.status],
    reviewStatus: 'not_reviewed',
    source: 'prompt_queue',
    executorUsed: 'claude',
    factoryRun: true,
    runnerMode: args.mode,
    factoryDispatch: true,
    dispatchMode: args.mode === 'auto' ? 'auto' : 'manual_copy',
    dispatchPlanId: `prompt-queue:${args.item.id}`,
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
    rawReport: `[prompt-queue ${args.mode}] item=${args.item.id}\n${args.result.stdout || args.result.resultSummary}`,
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
    nextActions: [],
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
  const factoryStatus = await computeFactoryStatus()
  if (factoryStatus.factoryRunState === 'Blocked') return finalize('blocked')

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
      const runId = await recordPromptQueueRun({ item, mode, prompt, result })
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
      const result = await getAdapter('claude').run({
        epicId: `prompt-queue:${item.id}`,
        prompt,
        cwd: opts.cwd,
        dryRun: false,
        safetyText: `${item.title} ${item.prompt}`,
      })
      const runId = await recordPromptQueueRun({ item, mode, prompt, result })
      if (result.status === 'completed' || result.status === 'partial') {
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
