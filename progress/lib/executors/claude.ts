import type { ExecutorAdapter, ExecutorResult, ExecutorRunInput } from './types'
import { runCommand, looksRateLimited, changedFilesIn, fileFingerprints, gitHead, changedFilesSince, parseNextActions, parseChangedFilesFromOutput } from './shell'

// Claude adapter（基本 executor）。`claude -p` を非対話で起動する。
// 上限検知時は rateLimited=true を返し、runner が AutoFallback 評価へ渡す。
// 既定の実行コマンドは env CLAUDE_BIN で上書き可。
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude'

export const claudeAdapter: ExecutorAdapter = {
  name: 'claude',
  async run(input: ExecutorRunInput): Promise<ExecutorResult> {
    if (input.dryRun) {
      return {
        status: 'needs_manual',
        stdout: '[dry-run] claude は起動していません',
        stderr: '',
        resultSummary: '[dry-run] claude -p を起動する想定（実起動なし）',
        changedFiles: [],
        rateLimited: false,
        needsApproval: false,
        nextActions: [],
      }
    }

    const cwd = input.cwd ?? process.cwd()
    const beforeHead = await gitHead(cwd)
    const beforeDirty = await changedFilesIn(cwd)
    const beforeFingerprints = await fileFingerprints(cwd, beforeDirty)
    // stdin は ignore（/dev/null 相当）。プロンプトは -p 引数で渡す。
    const r = await runCommand(CLAUDE_BIN, ['-p', input.prompt], {
      cwd,
      timeoutMs: input.timeoutMs ?? 300_000,
    })
    // コミット済み＋未コミットを集約（executor がコミットしても変更を取りこぼさない）。
    const changedFiles = Array.from(new Set([
      ...(await changedFilesSince(cwd, beforeHead, beforeDirty, beforeFingerprints)),
      ...parseChangedFilesFromOutput(`${r.stdout}\n${r.stderr}`),
    ]))
    const combined = `${r.stdout}\n${r.stderr}`
    const rateLimited = looksRateLimited(combined)

    let status: ExecutorResult['status']
    if (rateLimited) status = 'failed'
    else if (r.timedOut) status = 'partial'
    else if (r.code === 0) status = 'completed'
    else status = 'failed'

    return {
      status,
      stdout: r.stdout.slice(-8000),
      stderr: r.stderr.slice(-4000),
      resultSummary: rateLimited
        ? 'Claude 上限を検知（claude_rate_limited）'
        : r.stdout.split('\n').filter(Boolean).slice(-3).join(' / ').slice(0, 300) || '（出力なし）',
      changedFiles,
      errorType: rateLimited ? 'claude_rate_limited' : r.timedOut ? 'timeout' : r.code === 0 ? undefined : 'nonzero_exit',
      rateLimited,
      needsApproval: false,
      nextActions: parseNextActions(r.stdout),
    }
  },
}
