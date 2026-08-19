import { spawn } from 'child_process'
import { createHash } from 'crypto'
import fs from 'fs/promises'
import path from 'path'

// 実 executor 起動用の最小シェルヘルパー。タイムアウトと stdin プロンプト渡しに対応。
// CLI を直接呼ぶのは adapter 経由のみ（factory-runner が auto モードのときだけ）。

export interface ShellResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export function summarizeCodexResult(stdout: string, code: number | null, timedOut: boolean): string {
  const outputSummary = stdout.split('\n').filter(Boolean).slice(-3).join(' / ').slice(0, 300)
  if (outputSummary) return outputSummary
  if (timedOut) return 'Codexがタイムアウトしました（出力なし）'
  if (code !== 0) return `Codexが終了コード${code ?? '不明'}で終了しました（出力なし）`
  return '（出力なし）'
}

export function runCommand(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number; input?: string } = {},
): Promise<ShellResult> {
  const timeoutMs = opts.timeoutMs ?? 180_000
  // input 未指定時は stdin を 'ignore'（= /dev/null 相当）にする。
  // pipe のまま放置すると codex/claude が stdin EOF を待ち続けて hang するため。
  // input 指定時のみ pipe にして書き込み + end する。
  const wantStdin = typeof opts.input === 'string'
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: process.env,
      stdio: [wantStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)

    child.stdout?.on('data', (d) => { stdout += d.toString() })
    child.stderr?.on('data', (d) => { stderr += d.toString() })
    if (wantStdin && child.stdin) {
      child.stdin.write(opts.input as string)
      child.stdin.end()
    }
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: null, stdout, stderr: stderr + String(err), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr, timedOut })
    })
  })
}

// 上限・レート制限の文言検知（claude-limit-detector と同方針の最小版）。
const RATE_PATTERNS = [
  /rate[\s_/-]?limit/i,
  /usage[\s_-]?limit/i,
  /quota/i,
  /too many requests/i,
  /(^|[^0-9])429([^0-9]|$)/,
  /limit reached/i,
  /hit your .*limit/i,
  /weekly .*limit/i,
  /limit .*resets/i,
  /session limit/i,
  /overloaded/i,
  /利用制限|使用量の上限|上限に達/,
]

export function looksRateLimited(text: string): boolean {
  return RATE_PATTERNS.some((re) => re.test(text))
}

// git の未コミット変更ファイル一覧（cwd 配下・porcelain）。
export async function changedFilesIn(cwd: string): Promise<string[]> {
  const r = await runCommand('git', ['-C', cwd, 'status', '--porcelain', '--untracked-files=all'], { timeoutMs: 15_000 })
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\S+\s+/, ''))
}

/**
 * executor の出力から「次にやること」を抽出する。
 * 「次にやること / 次のアクション / Next steps / TODO」見出し以降の箇条書き行、
 * または行頭が箇条書き(- * ・ →)で next/todo を含む行を拾う（最大5件）。
 * factory-runner が result.nextActions をそのまま ExecutionRun へ記録するため、
 * 空固定だった nextActions を実出力から埋める。
 */
export function parseNextActions(stdout: string): string[] {
  const lines = (stdout || '').split('\n')
  const out: string[] = []
  const HEADING = /(次に?やる(べき)?こと|次の?アクション|next\s*(steps?|actions?)|やり残し|todo)/i
  const BULLET = /^\s*([-*・]|→|\d+[.)])\s+(.+)$/
  let inSection = false
  for (const raw of lines) {
    const line = raw.replace(/\r/g, '')
    if (/^\s*#{1,6}\s|^\s*\*\*|[:：]\s*$/.test(line) && HEADING.test(line)) { inSection = true; continue }
    if (inSection) {
      const m = line.match(BULLET)
      if (m) { out.push(m[2].trim()); continue }
      if (line.trim() === '') continue
      // 見出し直後の非箇条書き本文が来たらセクション終了。
      if (out.length > 0) inSection = false
    }
  }
  if (out.length === 0) {
    // 見出しが無くても、箇条書きで next/todo を含む行を拾う。
    for (const raw of lines) {
      const m = raw.match(BULLET)
      if (m && HEADING.test(m[2])) out.push(m[2].trim())
    }
  }
  return Array.from(new Set(out.map((s) => s.slice(0, 200)))).slice(0, 5)
}

const CHANGED_FILES_HEADING = /(変更(済み)?ファイル|changed\s*files?|files?\s*changed|modified\s*files?)/i
const FILE_FIELD = /["']?(?:file|path)["']?\s*:\s*["']([^"'\n]+)["']/gi
const PATH_TOKEN = /(?:^|[`'"\s([,{])((?:\.\/)?(?:(?:a|b)\/)?(?:(?:apps\/ny01\/progress|progress|app|components|lib|types|data|docs|scripts|tests|pages|public|src)\/[A-Za-z0-9_@./-]+|[A-Za-z0-9_@./-]+\.[A-Za-z0-9]{1,12}))(?=[`'"\s\]),:;}]|$)/g
const KNOWN_FILE_EXTENSIONS = new Set([
  'cjs',
  'css',
  'csv',
  'html',
  'js',
  'json',
  'jsx',
  'md',
  'mdx',
  'mjs',
  'ndjson',
  'scss',
  'sh',
  'sql',
  'svg',
  'ts',
  'tsx',
  'txt',
  'yaml',
  'yml',
])

// IPアドレス(例 127.0.0.1)や HTTP/1.1 のようなログ由来トークンを changedFiles から除外する。
const IP_LIKE = /^\d{1,3}(?:\.\d{1,3}){3}$/

function normalizeReportedPath(file: string): string | null {
  let normalized = file
    .trim()
    .replace(/^[-*・]\s+/, '')
    .replace(/^`|`$/g, '')
    .replace(/^\.\//, '')
    .replace(/[.,;:]+$/g, '')
  normalized = normalized.replace(/^[ab]\//, '')
  normalized = normalized.replace(/^apps\/ny01\/progress\//, '')
  normalized = normalized.replace(/^progress\//, '')
  if (!normalized) return null
  if (normalized.startsWith('/') || normalized.includes('..') || normalized.includes('://') || normalized.includes('//')) return null
  if (normalized.includes('node_modules/')) return null
  // ログ由来ノイズ除外: IPアドレス / 数字のみ拡張子(HTTP/1.1 等) / .env系(秘匿ファイル)
  if (IP_LIKE.test(normalized)) return null
  const base = normalized.slice(normalized.lastIndexOf('/') + 1)
  if (/^\.env(\.|$)/.test(base)) return null
  const dot = base.lastIndexOf('.')
  const ext = dot > 0 ? base.slice(dot + 1) : ''
  if (ext && /^\d+$/.test(ext)) return null
  if (ext && !KNOWN_FILE_EXTENSIONS.has(ext.toLowerCase())) return null
  if (!ext && !normalized.includes('/')) return null
  return normalized
}

function addReportedPath(out: Set<string>, file: string): void {
  const normalized = normalizeReportedPath(file)
  if (normalized) out.add(normalized)
}

function shouldReadPathTokens(line: string, inChangedFilesSection: boolean): boolean {
  if (CHANGED_FILES_HEADING.test(line)) return true
  if (!inChangedFilesSection) return false
  return /^\s*(?:[-*・]|\d+[.)]|\||["'\[]|(?:\.\/)?(?:(?:a|b)\/)?(?:apps\/ny01\/progress|progress|app|components|lib|types|data|docs|scripts|tests|pages|public|src)\/)/.test(line)
}

/**
 * executor の作業報告から変更ファイルを抽出する。
 * git差分が空でも、CLIが「変更ファイル」欄や changedFiles JSON に結果を書いた場合の補完用。
 */
export function parseChangedFilesFromOutput(output: string): string[] {
  const out = new Set<string>()
  const lines = (output || '').split('\n')
  let inChangedFilesSection = false

  for (const raw of lines) {
    const line = raw.replace(/\r/g, '')
    FILE_FIELD.lastIndex = 0
    let fieldMatch: RegExpExecArray | null
    while ((fieldMatch = FILE_FIELD.exec(line)) !== null) {
      const match = fieldMatch
      addReportedPath(out, match[1])
    }

    if (CHANGED_FILES_HEADING.test(line)) {
      inChangedFilesSection = true
    } else if (inChangedFilesSection && /^\s*(#{1,6}\s|\*\*[^*]+\*\*|[A-Za-z0-9_ -]+[:：])/.test(line) && !/^\s*[-*・]/.test(line)) {
      inChangedFilesSection = false
    }

    if (!shouldReadPathTokens(line, inChangedFilesSection)) continue
    PATH_TOKEN.lastIndex = 0
    let pathMatch: RegExpExecArray | null
    while ((pathMatch = PATH_TOKEN.exec(line)) !== null) {
      const match = pathMatch
      addReportedPath(out, match[1])
    }
  }

  return Array.from(out)
}

// 現在の HEAD コミットハッシュ（取得失敗時は空文字）。
export async function gitHead(cwd: string): Promise<string> {
  const r = await runCommand('git', ['-C', cwd, 'rev-parse', 'HEAD'], { timeoutMs: 15_000 })
  return r.code === 0 ? r.stdout.trim() : ''
}

/** dirtyファイルの内容指紋。実行前からdirtyでも、実行中に内容が変わったか判定するために使う。 */
export async function fileFingerprints(cwd: string, files: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(files.map(async (file) => {
    try {
      const content = await fs.readFile(path.resolve(cwd, file))
      return [file, createHash('sha256').update(content).digest('hex')] as const
    } catch {
      return [file, '__missing__'] as const
    }
  }))
  return Object.fromEntries(entries)
}

/**
 * 実行前後の差分から「この実行で変更されたファイル」を集約して返す。
 * executor が変更をコミットすると porcelain が clean になり changedFiles が空になる問題に対応:
 *   - 実行中にコミットされた変更: git diff --name-only <beforeHead>..HEAD
 *   - 実行後も未コミットの変更: 新規dirty + 実行前からdirtyでも内容指紋が変わったファイル
 */
export async function changedFilesSince(
  cwd: string,
  beforeHead: string,
  beforeDirty: string[],
  beforeFingerprints: Record<string, string> = {},
): Promise<string[]> {
  const set = new Set<string>()
  if (beforeHead) {
    const r = await runCommand('git', ['-C', cwd, 'diff', '--name-only', `${beforeHead}..HEAD`], { timeoutMs: 15_000 })
    if (r.code === 0) {
      r.stdout.split('\n').map((l) => l.trim()).filter(Boolean).forEach((f) => set.add(f))
    }
  }
  const beforeSet = new Set(beforeDirty)
  const after = await changedFilesIn(cwd)
  for (const f of after) if (!beforeSet.has(f)) set.add(f)
  const afterFingerprints = await fileFingerprints(cwd, Array.from(new Set([...beforeDirty, ...after])))
  for (const f of beforeDirty) {
    if (beforeFingerprints[f] !== afterFingerprints[f]) set.add(f)
  }
  return Array.from(set)
}
