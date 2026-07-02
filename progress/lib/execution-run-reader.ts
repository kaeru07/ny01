import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from './progress-reader'
import type { ExecutionRun, ExecutionRunsData, ChangedFile } from '@/types/execution-run'

function normalizeChangedFile(f: unknown): ChangedFile {
  if (typeof f === 'string') return { file: f, change: '' }
  if (typeof f === 'object' && f !== null) {
    const obj = f as Record<string, unknown>
    return {
      file: String(obj.file ?? ''),
      change: typeof obj.change === 'string' ? obj.change : '',
    }
  }
  return { file: String(f), change: '' }
}

export async function readExecutionRuns(): Promise<ExecutionRun[]> {
  try {
    const filePath = path.join(getDataPath(), 'execution-runs.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(content) as ExecutionRunsData
    if (!Array.isArray(data.runs)) return []
    const runs = data.runs.map((r) => ({
      ...r,
      changedFiles: Array.isArray(r.changedFiles)
        ? r.changedFiles.map(normalizeChangedFile)
        : [],
    }))
    return runs.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
  } catch {
    return []
  }
}

export function countUnreviewed(runs: ExecutionRun[]): number {
  return runs.filter(
    (r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup'
  ).length
}
