import { readJson } from './store'
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
  const data = await readJson<ExecutionRunsData>('execution-runs.json', { runs: [] })
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
}

export function countUnreviewed(runs: ExecutionRun[]): number {
  return runs.filter(
    (r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup'
  ).length
}
