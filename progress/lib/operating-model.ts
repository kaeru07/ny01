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
}

const DOC_PATH = path.join(process.cwd(), 'docs', 'operations', 'current-operating-model.md')
const DAY_MS = 24 * 60 * 60 * 1000

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

export async function getOperatingModelFreshness(): Promise<OperatingModelFreshness> {
  const { updated } = await readOperatingModelMeta()
  const days = operatingModelStaleDays(updated)
  return { updated, days, stale: days >= 14 }
}
