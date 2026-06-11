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

export async function updateReviewStatus(runId: string, reviewStatus: ReviewStatus, reviewMemo?: string): Promise<ExecutionRun | null> {
  const runs = await readAll()
  const idx = runs.findIndex((r) => r.runId === runId)
  if (idx === -1) return null
  runs[idx] = {
    ...runs[idx],
    reviewStatus,
    reviewMemo: reviewMemo !== undefined ? reviewMemo : runs[idx].reviewMemo,
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
