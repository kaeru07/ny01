import { promises as fs } from 'fs'
import path from 'path'

// 運用ページ最下部「最終更新」の正本 = docs/operations/current-operating-model.md の frontmatter。
// 運用変更時は md 側を更新すれば画面表示も追随する（画面側ハードコード禁止）。

export interface OperatingModelMeta {
  updated: string
  updateNote: string
}

export interface OperatingModelFreshness {
  updated: string
  days: number
  stale: boolean
  invalidUpdated: boolean
  implementationChangedAfterDoc: boolean
  latestImplementationPath: string
  latestImplementationDate: string
}

const DOC_PATH = path.join(process.cwd(), 'docs', 'operations', 'current-operating-model.md')
const DAY_MS = 24 * 60 * 60 * 1000
const WATCHED_IMPLEMENTATION_PATHS = [
  'app/guide/page.tsx',
  'components/operations/AutoExecReport.tsx',
  'components/operations/SystemSpecification.tsx',
  'components/operations/ResearchSpecification.tsx',
  'components/automation/LoopHealthCard.tsx',
  'lib/auto-queue.ts',
  'lib/command-center.ts',
  'lib/factory-runner.ts',
  'lib/knowledge-loop.ts',
  'lib/nav-menu.ts',
  'lib/operating-model.ts',
]

export async function readOperatingModelMeta(): Promise<OperatingModelMeta> {
  try {
    const raw = await fs.readFile(DOC_PATH, 'utf8')
    const updated = raw.match(/^updated:\s*(.+)$/m)?.[1]?.trim() ?? ''
    const updateNote = raw.match(/^updateNote:\s*(.+)$/m)?.[1]?.trim() ?? ''
    return { updated, updateNote }
  } catch {
    return { updated: '', updateNote: '' }
  }
}

export function operatingModelStaleDays(updated: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updated)
  if (!match) return -1

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const updatedAt = new Date(Date.UTC(year, month - 1, day))
  if (
    updatedAt.getUTCFullYear() !== year
    || updatedAt.getUTCMonth() !== month - 1
    || updatedAt.getUTCDate() !== day
  ) {
    return -1
  }

  const today = new Date()
  const todayAt = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((todayAt - updatedAt.getTime()) / DAY_MS)
}

function parseDateOnlyEnd(updated: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(updated)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(year, month - 1, day, 23, 59, 59, 999)
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
  ) {
    return null
  }
  return parsed
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function getLatestImplementationChange(): Promise<{ file: string; mtime: Date } | null> {
  const stats = await Promise.all(
    WATCHED_IMPLEMENTATION_PATHS.map(async (file) => {
      try {
        const stat = await fs.stat(path.join(process.cwd(), file))
        return { file, mtime: stat.mtime }
      } catch {
        return null
      }
    }),
  )

  return stats.reduce<{ file: string; mtime: Date } | null>((latest, current) => {
    if (!current) return latest
    if (!latest || current.mtime.getTime() > latest.mtime.getTime()) return current
    return latest
  }, null)
}

export async function getOperatingModelFreshness(): Promise<OperatingModelFreshness> {
  const { updated } = await readOperatingModelMeta()
  const days = operatingModelStaleDays(updated)
  const docUpdatedEnd = parseDateOnlyEnd(updated)
  const latestImplementation = await getLatestImplementationChange()
  const implementationChangedAfterDoc = Boolean(
    docUpdatedEnd
    && latestImplementation
    && latestImplementation.mtime.getTime() > docUpdatedEnd.getTime(),
  )

  return {
    updated,
    days,
    stale: days < 0 || days >= 14 || implementationChangedAfterDoc,
    invalidUpdated: days < 0,
    implementationChangedAfterDoc,
    latestImplementationPath: latestImplementation?.file ?? '',
    latestImplementationDate: latestImplementation ? formatDateOnly(latestImplementation.mtime) : '',
  }
}
