import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import { readJson, writeJson } from '@/lib/store'
import type { ExecutionRun, ExecutionRunsData } from '@/types/execution-run'

export interface ExecutionRunArchivePlan {
  shouldRotate: boolean
  activeCountBefore: number
  activeCountAfter: number
  archiveCount: number
  keptCount: number
  movableCount: number
  archiveFilename: string | null
  backupFilename: string | null
}

export interface ExecutionRunArchiveSummary {
  file: string
  count: number
}

const ACTIVE_FILE = 'execution-runs.json'
const ARCHIVE_THRESHOLD = 300
const KEEP_ACTIVE_COUNT = 240
const NEVER_ARCHIVE_REVIEW = new Set(['not_reviewed', 'needs_followup', 'needs_human'])
const NEVER_ARCHIVE_RUN = new Set(['running'])

function dataPath(...parts: string[]): string {
  return path.join(getDataPath(), ...parts)
}

function monthOf(run: ExecutionRun): string {
  const d = new Date(run.finishedAt || run.startedAt)
  if (Number.isNaN(d.getTime())) return 'unknown'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`
}

function canArchiveRun(run: ExecutionRun): boolean {
  return run.reviewStatus === 'reviewed' &&
    !NEVER_ARCHIVE_REVIEW.has(run.reviewStatus) &&
    !NEVER_ARCHIVE_RUN.has(run.runStatus)
}

function sortOldestFirst(a: ExecutionRun, b: ExecutionRun): number {
  return Date.parse(a.finishedAt || a.startedAt) - Date.parse(b.finishedAt || b.startedAt)
}

export function planExecutionRunArchive(runs: ExecutionRun[], now = new Date()): ExecutionRunArchivePlan {
  if (runs.length <= ARCHIVE_THRESHOLD) {
    return {
      shouldRotate: false,
      activeCountBefore: runs.length,
      activeCountAfter: runs.length,
      archiveCount: 0,
      keptCount: runs.length,
      movableCount: runs.filter(canArchiveRun).length,
      archiveFilename: null,
      backupFilename: null,
    }
  }

  const movable = runs.filter(canArchiveRun).sort(sortOldestFirst)
  const desiredMove = Math.max(0, runs.length - KEEP_ACTIVE_COUNT)
  const archiveCount = Math.min(movable.length, desiredMove)
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const archiveMonth = archiveCount > 0 ? monthOf(movable[0]) : null

  return {
    shouldRotate: archiveCount > 0,
    activeCountBefore: runs.length,
    activeCountAfter: runs.length - archiveCount,
    archiveCount,
    keptCount: runs.length - archiveCount,
    movableCount: movable.length,
    archiveFilename: archiveMonth ? `archive/execution-runs-${archiveMonth}.json` : null,
    backupFilename: `_backups/execution-runs-${stamp}.json`,
  }
}

async function readRunsFile(filename: string): Promise<ExecutionRun[]> {
  const parsed = await readJson<ExecutionRunsData>(filename, { runs: [] })
  return Array.isArray(parsed.runs) ? parsed.runs : []
}

async function writeRunsFile(filename: string, runs: ExecutionRun[]): Promise<void> {
  await writeJson(filename, { runs })
}

export async function rotateExecutionRunsArchive(): Promise<ExecutionRunArchivePlan> {
  const activePath = dataPath(ACTIVE_FILE)
  const runs = await readRunsFile(ACTIVE_FILE)
  const plan = planExecutionRunArchive(runs)
  if (!plan.shouldRotate || !plan.archiveFilename || !plan.backupFilename) return plan

  const movableIds = new Set(runs.filter(canArchiveRun).sort(sortOldestFirst).slice(0, plan.archiveCount).map((r) => r.runId))
  const moving = runs.filter((r) => movableIds.has(r.runId))
  const keeping = runs.filter((r) => !movableIds.has(r.runId))
  const backupPath = dataPath(plan.backupFilename)
  const existingArchive = await readRunsFile(plan.archiveFilename)

  await fs.mkdir(path.dirname(backupPath), { recursive: true })
  await fs.copyFile(activePath, backupPath)
  await writeRunsFile(plan.archiveFilename, [...existingArchive, ...moving])
  await writeRunsFile(ACTIVE_FILE, keeping)

  return {
    ...plan,
    activeCountAfter: keeping.length,
    archiveCount: moving.length,
    keptCount: keeping.length,
  }
}

export async function readExecutionRunArchiveSummaries(): Promise<ExecutionRunArchiveSummary[]> {
  const archiveDir = dataPath('archive')
  try {
    const files = (await fs.readdir(archiveDir)).filter((file) => /^execution-runs-\d{6}\.json$/.test(file)).sort().reverse()
    const summaries: ExecutionRunArchiveSummary[] = []
    for (const file of files) {
      const runs = await readRunsFile(path.posix.join('archive', file))
      summaries.push({ file, count: runs.length })
    }
    return summaries
  } catch {
    return []
  }
}
