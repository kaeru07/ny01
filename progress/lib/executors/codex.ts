import type { ExecutorAdapter, ExecutorResult, ExecutorRunInput } from './types'
import { runCommand, changedFilesIn, gitHead, changedFilesSince } from './shell'
import { classifyCodexEligibility } from '@/lib/operations-store'

// Codex adapter（Claude 上限後の fallback executor）。`codex exec` を非対話で起動する。
// 実行前に必ず安全判定を行い、危険シグナルを含むなら起動しない（needsApproval=true）。
const CODEX_BIN = process.env.CODEX_BIN ?? 'codex'

export const codexAdapter: ExecutorAdapter = {
  name: 'codex',
  async run(input: ExecutorRunInput): Promise<ExecutorResult> {
    // 安全判定（runner 側でも判定済みだが二重ゲート）。deny シグナルがあれば起動しない。
    // prompt にはガード文言（課金/削除等の禁止語）が含まれるため、意図テキスト(safetyText)を優先評価する。
    const verdict = classifyCodexEligibility(input.safetyText ?? input.prompt)
    if (!verdict.eligible) {
      return {
        status: 'needs_manual',
        stdout: '',
        stderr: '',
        resultSummary: `Codex 安全判定で停止: ${verdict.reason}`,
        changedFiles: [],
        errorType: 'codex_safety_block',
        rateLimited: false,
        needsApproval: true,
        nextActions: [],
      }
    }

    if (input.dryRun) {
      return {
        status: 'needs_manual',
        stdout: '[dry-run] codex は起動していません',
        stderr: '',
        resultSummary: '[dry-run] codex exec を起動する想定（実起動なし・安全判定OK）',
        changedFiles: [],
        rateLimited: false,
        needsApproval: false,
        nextActions: [],
      }
    }

    const cwd = input.cwd ?? process.cwd()
    const beforeHead = await gitHead(cwd)
    const beforeDirty = await changedFilesIn(cwd)
    // 非対話・workspace-write サンドボックス（cwd 配下のみ書込可）。stdin は空で閉じる。
    // stdin は ignore（/dev/null 相当）。プロンプトは引数で渡す。
    const r = await runCommand(
      CODEX_BIN,
      ['exec', '-C', cwd, '--skip-git-repo-check', '-s', 'workspace-write', input.prompt],
      { cwd, timeoutMs: input.timeoutMs ?? 300_000 },
    )
    // コミット済み＋未コミットを集約（executor がコミットしても変更を取りこぼさない）。
    const changedFiles = await changedFilesSince(cwd, beforeHead, beforeDirty)

    const status: ExecutorResult['status'] = r.timedOut ? 'partial' : r.code === 0 ? 'completed' : 'failed'
    return {
      status,
      stdout: r.stdout.slice(-8000),
      stderr: r.stderr.slice(-4000),
      resultSummary: r.stdout.split('\n').filter(Boolean).slice(-3).join(' / ').slice(0, 300) || '（出力なし）',
      changedFiles,
      errorType: r.timedOut ? 'timeout' : r.code === 0 ? undefined : 'nonzero_exit',
      rateLimited: false,
      needsApproval: false,
      nextActions: [],
    }
  },
}
