export interface InboxItem {
  /** 一意キー = 相対パス */
  file: string
  absPath: string
  /** 内容ハッシュ（冪等判定に使用） */
  hash: string
  title: string
  source: string
  createdAt?: string
  /** 本文（frontmatter 除去後、上限あり） */
  body: string
  /** "## ToDo候補" 等から抽出した箇条書き */
  todoCandidates: string[]
  imported: boolean
  importedTaskId?: string
  importedAt?: string
}

export interface InboxImportRecord {
  file: string
  hash: string
  taskId: string
  projectId: string
  importedAt: string
}

export interface InboxStateData {
  imported: InboxImportRecord[]
}
