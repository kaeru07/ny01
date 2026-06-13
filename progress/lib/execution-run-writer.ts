import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import type { ExecutionRun, ExecutionRunsData, ReviewStatus } from '@/types/execution-run'

async function readAll(): Promise<ExecutionRun[]> {
  try {
    const filePath = path.join(getDataPath(), 'execution-runs.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content) as ExecutionRunsData
    return Array.isArray(data.runs) ? data.runs : []
  } catch {
    return []
  }
}

async function writeAll(runs: ExecutionRun[]): Promise<void> {
  const filePath = path.join(getDataPath(), 'execution-runs.json')
  const data: ExecutionRunsData = { runs }
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
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
  const options = typeof reviewMemoOrOptions === 'string' ? { reviewMemo: reviewMemoOrOptions } : reviewMemoOrOptions
  const fixPrompt = reviewStatus === 'needs_followup' ? options?.fixPrompt?.trim() : undefined
  const fixMemo = fixPrompt ? `修正指示: ${fixPrompt}` : undefined
  const reviewMemo = options?.reviewMemo !== undefined
    ? options.reviewMemo
    : fixMemo
      ? [runs[idx].reviewMemo, fixMemo].filter(Boolean).join('\n')
      : runs[idx].reviewMemo
  runs[idx] = {
    ...runs[idx],
    reviewStatus,
    reviewMemo,
    ...(fixPrompt ? {
      fixPrompt,
      fixRequestedAt: new Date().toISOString(),
      fixRequestedBy: 'human' as const,
    } : {}),
    reviewedAt: reviewStatus === 'reviewed' ? new Date().toISOString() : runs[idx].reviewedAt,
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
