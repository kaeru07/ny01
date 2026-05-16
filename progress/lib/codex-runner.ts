import { spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { execFile } from 'node:child_process'
import crypto from 'node:crypto'
import type { CodexRun, CodexSandbox, CodexStatus } from '@/types/codex-run'

const execFileAsync = promisify(execFile)

export const CODEX_BIN = process.env.CODEX_BIN ?? 'codex'
export const DEFAULT_TIMEOUT_MS = 120_000
export const MAX_TIMEOUT_MS = 600_000
export const MAX_PROMPT_CHARS = 8_000
export const MAX_STDIO_BYTES = 256 * 1024

let activeRun: { runId: string; startedAt: string } | null = null

export function getActiveRun() {
  return activeRun
}

export function generateCodexRunId(): string {
  const now = new Date()
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '')
  const hms = now.toISOString().slice(11, 19).replace(/:/g, '')
  const rand = crypto.randomBytes(2).toString('hex')
  return `cx-${ymd}-${hms}-${rand}`
}

export async function checkCodexStatus(): Promise<CodexStatus> {
  let binaryPath: string | undefined
  try {
    const { stdout } = await execFileAsync('which', [CODEX_BIN], { timeout: 5_000 })
    binaryPath = stdout.trim() || undefined
  } catch {
    return {
      ok: false,
      reason: `codex CLI が見つかりません (${CODEX_BIN})。VPS に codex がインストールされているか確認してください。`,
    }
  }
  if (!binaryPath) {
    return { ok: false, reason: `codex CLI のパスを取得できませんでした` }
  }

  let version: string | undefined
  try {
    const { stdout } = await execFileAsync(CODEX_BIN, ['--version'], { timeout: 5_000 })
    version = stdout.trim() || undefined
  } catch (err) {
    return {
      ok: false,
      reason: `codex --version の実行に失敗: ${(err as Error).message}`,
      binaryPath,
    }
  }

  let login: 'logged_in' | 'logged_out' | 'unknown' = 'unknown'
  let loginRaw: string | undefined
  try {
    // `codex login status` は exit 0 で結果を stderr に出すことがあるため両方を見る
    const { stdout, stderr } = await execFileAsync(CODEX_BIN, ['login', 'status'], {
      timeout: 5_000,
    })
    loginRaw = `${stdout}${stderr}`.trim()
    login = /Logged in/i.test(loginRaw) ? 'logged_in' : 'logged_out'
  } catch (err) {
    const e = err as Error & { stdout?: string; stderr?: string }
    loginRaw = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() || e.message
    login = /Logged in/i.test(loginRaw) ? 'logged_in' : 'logged_out'
  }

  if (login !== 'logged_in') {
    return {
      ok: false,
      reason:
        'codex にログインしていません。VPS で `codex login` を実行して ChatGPT ログインを完了させてください。',
      binaryPath,
      version,
      login,
      loginRaw,
    }
  }

  return { ok: true, binaryPath, version, login, loginRaw }
}

export interface CodexExecOptions {
  prompt: string
  timeoutMs?: number
  sandbox?: CodexSandbox
  workingDir?: string
  targetTodoId?: string
  targetTodoTitle?: string
  queueItemId?: string
  projectId?: string
  projectName?: string
}

export interface CodexExecResult {
  run: CodexRun
}

function clipBuffer(buf: Buffer): { value: string; truncated: boolean } {
  if (buf.byteLength <= MAX_STDIO_BYTES) {
    return { value: buf.toString('utf-8'), truncated: false }
  }
  return {
    value: buf.subarray(0, MAX_STDIO_BYTES).toString('utf-8'),
    truncated: true,
  }
}

export async function runCodexExec(opts: CodexExecOptions): Promise<CodexExecResult> {
  if (activeRun) {
    throw new Error(`Codex は1度に1件のみ実行できます (実行中: ${activeRun.runId})`)
  }
  const prompt = (opts.prompt ?? '').trim()
  if (!prompt) {
    throw new Error('プロンプトが空です')
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(`プロンプトが長すぎます (${prompt.length} > ${MAX_PROMPT_CHARS})`)
  }

  const timeoutMs = Math.min(
    Math.max(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 5_000),
    MAX_TIMEOUT_MS,
  )
  const sandbox: CodexSandbox = opts.sandbox === 'workspace-write' ? 'workspace-write' : 'read-only'
  const workingDir = opts.workingDir ?? process.cwd()

  const runId = generateCodexRunId()
  const startedAt = new Date().toISOString()
  const args = [
    'exec',
    '--sandbox',
    sandbox,
    '--skip-git-repo-check',
    '--color',
    'never',
    '-C',
    workingDir,
    prompt,
  ]

  activeRun = { runId, startedAt }
  const startedAtMs = Date.now()
  let stdoutBuf = Buffer.alloc(0)
  let stderrBuf = Buffer.alloc(0)
  let timedOut = false
  let exitCode: number | null = null
  let signal: NodeJS.Signals | null = null
  let errorMessage: string | undefined

  try {
    await new Promise<void>((resolve) => {
      const c = spawn(CODEX_BIN, args, {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NO_COLOR: '1' },
      })

      const timer = setTimeout(() => {
        timedOut = true
        try {
          c.kill('SIGTERM')
          setTimeout(() => {
            try {
              c.kill('SIGKILL')
            } catch {
              // already gone
            }
          }, 5_000)
        } catch {
          // ignore
        }
      }, timeoutMs)

      c.stdout?.on('data', (chunk: Buffer) => {
        if (stdoutBuf.byteLength < MAX_STDIO_BYTES * 2) {
          stdoutBuf = Buffer.concat([stdoutBuf, chunk])
        }
      })
      c.stderr?.on('data', (chunk: Buffer) => {
        if (stderrBuf.byteLength < MAX_STDIO_BYTES * 2) {
          stderrBuf = Buffer.concat([stderrBuf, chunk])
        }
      })

      c.on('error', (err) => {
        errorMessage = err.message
      })
      c.on('close', (code, sig) => {
        clearTimeout(timer)
        exitCode = code
        signal = sig
        resolve()
      })
    })
  } finally {
    activeRun = null
  }

  const finishedAt = new Date().toISOString()
  const durationMs = Date.now() - startedAtMs
  const stdoutClip = clipBuffer(stdoutBuf)
  const stderrClip = clipBuffer(stderrBuf)

  const status: CodexRun['status'] = timedOut
    ? 'timeout'
    : exitCode === 0
    ? 'completed'
    : 'failed'

  const run: CodexRun = {
    runId,
    startedAt,
    finishedAt,
    durationMs,
    status,
    exitCode,
    signal: signal ?? null,
    timeoutMs,
    sandbox,
    workingDir,
    promptUsed: prompt,
    targetTodoId: opts.targetTodoId,
    targetTodoTitle: opts.targetTodoTitle,
    queueItemId: opts.queueItemId,
    projectId: opts.projectId,
    projectName: opts.projectName,
    command: CODEX_BIN,
    args,
    stdout: stdoutClip.value,
    stderr: stderrClip.value,
    stdoutTruncated: stdoutClip.truncated,
    stderrTruncated: stderrClip.truncated,
    errorMessage: errorMessage ?? (timedOut ? `タイムアウト (${timeoutMs}ms)` : undefined),
  }

  return { run }
}
