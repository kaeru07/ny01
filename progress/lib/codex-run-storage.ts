import fs from 'node:fs/promises'
import path from 'node:path'
import { getDataPath } from '@/lib/progress-reader'
import type { CodexRun, CodexRunsData } from '@/types/codex-run'

const FILE_NAME = 'codex-runs.json'

function filePath(): string {
  return path.join(getDataPath(), FILE_NAME)
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(getDataPath(), { recursive: true })
}

export async function listCodexRuns(limit = 100): Promise<CodexRun[]> {
  try {
    const content = await fs.readFile(filePath(), 'utf-8')
    const data = JSON.parse(content) as CodexRunsData
    const runs = Array.isArray(data.runs) ? data.runs : []
    const sorted = [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return sorted.slice(0, limit)
  } catch {
    return []
  }
}

export async function readCodexRun(runId: string): Promise<CodexRun | null> {
  const runs = await listCodexRuns(1_000)
  return runs.find((r) => r.runId === runId) ?? null
}

export async function appendCodexRun(run: CodexRun): Promise<void> {
  await ensureDir()
  let runs: CodexRun[] = []
  try {
    const content = await fs.readFile(filePath(), 'utf-8')
    const parsed = JSON.parse(content) as CodexRunsData
    runs = Array.isArray(parsed.runs) ? parsed.runs : []
  } catch {
    runs = []
  }
  runs.push(run)
  const data: CodexRunsData = { runs }
  await fs.writeFile(filePath(), JSON.stringify(data, null, 2), 'utf-8')
}
