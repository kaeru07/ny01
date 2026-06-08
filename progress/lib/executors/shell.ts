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

// git の変更ファイル一覧（cwd 配下）。
export async function changedFilesIn(cwd: string): Promise<string[]> {
  const r = await runCommand('git', ['-C', cwd, 'status', '--porcelain'], { timeoutMs: 15_000 })
  return r.stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\S+\s+/, ''))
}
