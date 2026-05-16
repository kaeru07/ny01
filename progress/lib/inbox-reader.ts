import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { getDataPath } from '@/lib/progress-reader'
import type { InboxItem, InboxStateData } from '@/types/inbox'

/**
 * ChatGPT 投函の読み込み元。
 * 既定は GitHub 管理 Vault の 00_inbox（ChatGPT が push する側）。
 * CHATGPT_INBOX_PATH で上書き可能（検証時に sync-vault を指す等）。
 */
export function getInboxRoot(): string {
  return (
    process.env.CHATGPT_INBOX_PATH ??
    '/root/company/obsidian-vault/00_inbox'
  )
}

const STATE_FILE = 'inbox-state.json'
const BODY_LIMIT = 4000
// 投函以外の運用ファイルは対象外
const EXCLUDE_NAMES = new Set(['inbox.md', 'README.md', '未整理メモ.md'])

function stateFilePath(): string {
  return path.join(getDataPath(), STATE_FILE)
}

export async function readInboxState(): Promise<InboxStateData> {
  try {
    const raw = await fs.readFile(stateFilePath(), 'utf-8')
    const data = JSON.parse(raw) as InboxStateData
    return { imported: Array.isArray(data.imported) ? data.imported : [] }
  } catch {
    return { imported: [] }
  }
}

export async function writeInboxState(data: InboxStateData): Promise<void> {
  await fs.mkdir(getDataPath(), { recursive: true })
  await fs.writeFile(stateFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

async function walkMarkdown(dir: string, acc: string[]): Promise<void> {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      await walkMarkdown(full, acc)
    } else if (e.isFile() && e.name.endsWith('.md') && !EXCLUDE_NAMES.has(e.name)) {
      acc.push(full)
    }
  }
}

function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return { meta: {}, body: text }
  const meta: Record<string, string> = {}
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const k = line.slice(0, idx).trim()
    const v = line.slice(idx + 1).trim()
    if (k) meta[k] = v
  }
  return { meta, body: m[2] }
}

function extractTodoCandidates(body: string): string[] {
  const lines = body.split('\n')
  const out: string[] = []
  let inList = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^#{1,6}\s/.test(line)) {
      inList = /todo|やること|候補/i.test(line)
      continue
    }
    const li = line.match(/^[-*]\s+(.+)$/)
    if (li && (inList || out.length > 0 || /todo/i.test(body.slice(0, 200)))) {
      out.push(li[1].trim())
    }
  }
  return out.slice(0, 30)
}

function isChatgptSource(meta: Record<string, string>, body: string, relPath: string): boolean {
  const src = (meta.source ?? '').toLowerCase()
  if (src === 'chatgpt') return true
  if (relPath.includes('chatgpt-todo/')) return true
  // フォールバック: 明示的に source 未設定でも本文先頭に source: chatgpt があれば拾う
  return /source:\s*chatgpt/i.test(body.slice(0, 300))
}

export async function listInboxItems(): Promise<InboxItem[]> {
  const root = getInboxRoot()
  const files: string[] = []
  await walkMarkdown(root, files)
  const state = await readInboxState()
  const importedByHash = new Map(state.imported.map((r) => [r.hash, r]))

  const items: InboxItem[] = []
  for (const abs of files.sort()) {
    let text: string
    try {
      text = await fs.readFile(abs, 'utf-8')
    } catch {
      continue
    }
    const rel = path.relative(root, abs)
    const { meta, body } = parseFrontmatter(text)
    if (!isChatgptSource(meta, body, rel)) continue

    const hash = crypto.createHash('sha1').update(text).digest('hex').slice(0, 16)
    const rec = importedByHash.get(hash)
    const trimmedBody = body.trim()
    items.push({
      file: rel,
      absPath: abs,
      hash,
      title: meta.title || rel.replace(/\.md$/, ''),
      source: meta.source || 'chatgpt',
      createdAt: meta.createdAt,
      body: trimmedBody.length > BODY_LIMIT ? trimmedBody.slice(0, BODY_LIMIT) + ' …(truncated)' : trimmedBody,
      todoCandidates: extractTodoCandidates(body),
      imported: !!rec,
      importedTaskId: rec?.taskId,
      importedAt: rec?.importedAt,
    })
  }
  return items
}

export async function findInboxItem(file: string): Promise<InboxItem | null> {
  const items = await listInboxItems()
  return items.find((i) => i.file === file) ?? null
}
