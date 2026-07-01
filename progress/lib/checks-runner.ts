import { runCommand } from './executors/shell'

// lint ゲートの純関数は依存ゼロの checks-gate.ts に分離し、ここから再エクスポートする
// （既存 import 元 factory-runner.ts は './checks-runner' のまま無改変で動く）。
export { NG_CHECK_PATTERN, failingChecks, gateRunStatusByChecks } from './checks-gate'

// Level1（機械判定）: build / typecheck / lint を実行して OK/NG を返す。
// 結果は ExecutionRun.checks に構造化保存する（新正本は作らない）。executor 非依存。

export interface ChecksRunResult {
  build?: string
  typescript?: string
  lint?: string
  [k: string]: string | undefined
}

export async function runChecks(
  cwd: string,
  opts: { build?: boolean; typecheck?: boolean; lint?: boolean } = {},
): Promise<ChecksRunResult> {
  const out: ChecksRunResult = {}
  // 既定では typecheck のみ（軽量）。build は重いので明示時のみ。
  const doTs = opts.typecheck !== false
  if (doTs) {
    const r = await runCommand('npx', ['tsc', '--noEmit'], { cwd, timeoutMs: 180_000 })
    out.typescript = r.code === 0 ? 'OK' : 'NG'
  }
  if (opts.lint) {
    const r = await runCommand('npx', ['next', 'lint'], { cwd, timeoutMs: 180_000 })
    out.lint = r.code === 0 ? 'OK' : 'NG'
  }
  if (opts.build) {
    const r = await runCommand('npm', ['run', 'build'], { cwd, timeoutMs: 420_000 })
    out.build = r.code === 0 ? 'OK' : 'NG'
  }
  return out
}
