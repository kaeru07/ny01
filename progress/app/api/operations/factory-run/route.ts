import { NextResponse } from 'next/server'
import { runFactory } from '@/lib/factory-runner'
import type { FactoryRunMode } from '@/lib/executors/types'

export const dynamic = 'force-dynamic'

const VALID_MODES: FactoryRunMode[] = ['dry_run', 'manual', 'auto']

// POST: factory-runner を 1 回起動する。
//   body: { mode?: 'dry_run'|'manual'|'auto', maxPerEpic?, confirm? }
//   - 既定は dry_run（実起動なし）。auto は confirm:true がないと実起動しない。
//   - Factory OFF のときは何もしない（factory_off）。maxRuns は外部から制御しない。
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const mode: FactoryRunMode = VALID_MODES.includes(body?.mode) ? body.mode : 'dry_run'
  const report = await runFactory({
    mode,
    maxPerEpic: typeof body?.maxPerEpic === 'number' ? body.maxPerEpic : undefined,
    confirm: body?.confirm === true,
    // テスト用: Claude を擬似上限化して Codex fallback 経路を検証する。
    simulateRateLimit: body?.simulateRateLimit === true,
    // テスト用: 指定Run番号以降だけ Claude 上限扱いにする（Run1=Claude / Run2=Codex など）。
    simulateRateLimitFromRun: typeof body?.simulateRateLimitFromRun === 'number' ? body.simulateRateLimitFromRun : undefined,
    // テスト用: 上限発生前のClaude Runを実起動せず成功扱いにする。
    simulateClaudeSuccessBeforeRateLimit: body?.simulateClaudeSuccessBeforeRateLimit === true,
    // テスト用: fallback後のCodex Runを実起動せず成功扱いにする。
    simulateCodexSuccessAfterFallback: body?.simulateCodexSuccessAfterFallback === true,
    // executor / checks の実行ディレクトリ（サンドボックス分離に使用）。
    cwd: typeof body?.cwd === 'string' && body.cwd.trim() ? body.cwd.trim() : undefined,
  })
  return NextResponse.json(report)
}
