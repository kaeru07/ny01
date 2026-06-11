import { promises as fs } from 'fs'
import path from 'path'

// 運用ページ最下部「最終更新」の正本 = docs/operations/current-operating-model.md の frontmatter。
// 運用変更時は md 側を更新すれば画面表示も追随する（画面側ハードコード禁止）。

export interface OperatingModelMeta {
  updated: string
  updateNote: string
}

const DOC_PATH = path.join(process.cwd(), 'docs', 'operations', 'current-operating-model.md')

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
