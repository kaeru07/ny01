import fs from 'fs'
import path from 'path'
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

// 対象アプリの実態（package.json / tsconfig / scripts）を見て、実行可能なチェックだけを選ぶ。
// progress前提の固定コマンド（next lint 等）を新規/Expo等の別種アプリに撃つと誤NG→
// lintゲートで永久partial化するため、無いものは実行せず undefined（=判定対象外）にする。
function readAppCheckProfile(cwd: string): { hasPackageJson: boolean; hasTsconfig: boolean; scripts: Record<string, string> } {
  const profile = { hasPackageJson: false, hasTsconfig: false, scripts: {} as Record<string, string> }
  try {
    profile.hasTsconfig = fs.existsSync(path.join(cwd, 'tsconfig.json'))
    const pkgPath = path.join(cwd, 'package.json')
    if (fs.existsSync(pkgPath)) {
      profile.hasPackageJson = true
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> }
      profile.scripts = pkg.scripts ?? {}
    }
  } catch {
    // 読めない場合はチェックなし扱い（誤NGで殺さない）
  }
  return profile
}

export async function runChecks(
  cwd: string,
  opts: { build?: boolean; typecheck?: boolean; lint?: boolean } = {},
): Promise<ChecksRunResult> {
  const out: ChecksRunResult = {}
  const profile = readAppCheckProfile(cwd)
  // scaffold前（package.json/tsconfigなし）はチェック不能。誤NGにせず空を返す。
  if (!profile.hasPackageJson && !profile.hasTsconfig) return out

  // 既定では typecheck のみ（軽量）。build は重いので明示時のみ。
  const doTs = opts.typecheck !== false && profile.hasTsconfig
  if (doTs) {
    const r = await runCommand('npx', ['tsc', '--noEmit'], { cwd, timeoutMs: 180_000 })
    out.typescript = r.code === 0 ? 'OK' : 'NG'
  }
  if (opts.lint && typeof profile.scripts.lint === 'string') {
    const r = await runCommand('npm', ['run', 'lint'], { cwd, timeoutMs: 180_000 })
    out.lint = r.code === 0 ? 'OK' : 'NG'
  }
  if (opts.build && typeof profile.scripts.build === 'string') {
    const r = await runCommand('npm', ['run', 'build'], { cwd, timeoutMs: 420_000 })
    out.build = r.code === 0 ? 'OK' : 'NG'
  }
  return out
}
