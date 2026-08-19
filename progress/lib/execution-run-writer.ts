import { readJson, writeJson } from '@/lib/store'
import { gateReviewStatusByChecks } from '@/lib/checks-gate'
import type { ExecutionRun, ExecutionRunsData, ReviewStatus } from '@/types/execution-run'

async function readAll(): Promise<ExecutionRun[]> {
  const data = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
  return Array.isArray(data.runs) ? data.runs : []
}

async function writeAll(runs: ExecutionRun[]): Promise<void> {
  const data: ExecutionRunsData = { runs }
  await writeJson('execution-runs.json', data)
}

export interface ReviewStatusUpdateOptions {
  reviewMemo?: string
  fixPrompt?: string
}

export async function updateReviewStatus(
  runId: string,
  reviewStatus: ReviewStatus,
  reviewMemoOrOptions?: string | ReviewStatusUpdateOptions,
): Promise<ExecutionRun | null> {
  const runs = await readAll()
  const idx = runs.findIndex((r) => r.runId === runId)
  if (idx === -1) return null
  const gatedReviewStatus = gateReviewStatusByChecks(reviewStatus, runs[idx].checks)
  const options = typeof reviewMemoOrOptions === 'string' ? { reviewMemo: reviewMemoOrOptions } : reviewMemoOrOptions
  const fixPrompt = gatedReviewStatus === 'needs_followup' ? options?.fixPrompt?.trim() : undefined
  const fixMemo = fixPrompt ? `修正指示: ${fixPrompt}` : undefined
  const reviewMemo = options?.reviewMemo !== undefined
    ? options.reviewMemo
    : fixMemo
      ? [runs[idx].reviewMemo, fixMemo].filter(Boolean).join('\n')
      : runs[idx].reviewMemo
  runs[idx] = {
    ...runs[idx],
    reviewStatus: gatedReviewStatus,
    reviewMemo,
    ...(fixPrompt ? {
      fixPrompt,
      fixRequestedAt: new Date().toISOString(),
      fixRequestedBy: 'human' as const,
    } : {}),
    reviewedAt: gatedReviewStatus === 'reviewed' ? new Date().toISOString() : runs[idx].reviewedAt,
  }
  await writeAll(runs)
  return runs[idx]
}

export async function addExecutionRun(run: ExecutionRun): Promise<void> {
  const runs = await readAll()
  runs.push(run)
  await writeAll(runs)
}

/** 既存 Run に追記フィールド（doneCriteriaStatus / stopReason 等）をパッチする。 */
export async function updateExecutionRunFields(runId: string, patch: Partial<ExecutionRun>): Promise<boolean> {
  const runs = await readAll()
  const idx = runs.findIndex((r) => r.runId === runId)
  if (idx === -1) return false
  runs[idx] = { ...runs[idx], ...patch, runId }
  await writeAll(runs)
  return true
}
