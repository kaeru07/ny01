import { spawn } from 'child_process'

// 実 executor 起動用の最小シェルヘルパー。タイムアウトと stdin プロンプト渡しに対応。
// CLI を直接呼ぶのは adapter 経由のみ（factory-runner が auto モードのときだけ）。

export interface ShellResult {
  code: number | null
  stdout: string
  stderr: string
  timedOut: boolean
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
  /session limit/i,
  /overloaded/i,
  /利用制限|使用量の上限|上限に達/,
]

export function looksRateLimited(text: string): boolean {
  return RATE_PATTERNS.some((re) => re.test(text))
}

// git の未コミット変更ファイル一覧（cwd 配下・porcelain）。
export async function changedFilesIn(cwd: string): Promise<string[]> {
  const r = await runCommand('git', ['-C', cwd, 'status', '--porcelain'], { timeoutMs: 15_000 })
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

// 現在の HEAD コミットハッシュ（取得失敗時は空文字）。
export async function gitHead(cwd: string): Promise<string> {
  const r = await runCommand('git', ['-C', cwd, 'rev-parse', 'HEAD'], { timeoutMs: 15_000 })
  return r.code === 0 ? r.stdout.trim() : ''
}

/**
 * 実行前後の差分から「この実行で変更されたファイル」を集約して返す。
 * executor が変更をコミットすると porcelain が clean になり changedFiles が空になる問題に対応:
 *   - 実行中にコミットされた変更: git diff --name-only <beforeHead>..HEAD
 *   - 実行後も未コミットの変更: porcelain（実行前から dirty だった分は除外し、この実行起因のみ）
 */
export async function changedFilesSince(cwd: string, beforeHead: string, beforeDirty: string[]): Promise<string[]> {
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
  return Array.from(set)
}
