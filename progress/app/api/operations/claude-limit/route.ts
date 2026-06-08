import { NextResponse } from 'next/server'
import { detectClaudeLimit } from '@/lib/claude-limit-detector'
import { triggerAutoFallback, appendDetectionLog } from '@/lib/operations-store'
import type { ClaudeLimitDetectResponse } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

// GET: Claude 上限を「検知だけ」する（副作用なし）。UI のポーリング表示用。
// windowMinutes で採用する時間窓を上書きできる（既定 180 分）。
export async function GET(request: Request) {
  const url = new URL(request.url)
  const w = Number(url.searchParams.get('windowMinutes'))
  const detection = await detectClaudeLimit({
    windowMinutes: Number.isFinite(w) && w > 0 ? w : undefined,
  })
  return NextResponse.json({ detection })
}

// POST: 検知 → 検知ログ追記 → recommendation が trigger_fallback なら既存 triggerAutoFallback を実行。
//   - Auto Fallback の安全ゲート（evaluateAutoFallback）は一切変更しない。検知はその前段に乗るだけ。
//   - ambiguous（誤判定回避）のときは fallback を実行しない（block_for_review）。
//   - force=true（手動上書き）のときは検知結果に関わらず fallback を評価する。
export async function POST(request: Request): Promise<NextResponse<ClaudeLimitDetectResponse>> {
  const body = await request.json().catch(() => ({}))
  const epicId =
    typeof body?.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined
  const force = body?.force === true
  const windowMinutes = Number(body?.windowMinutes)

  const detection = await detectClaudeLimit({
    windowMinutes: Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : undefined,
  })
  await appendDetectionLog(detection)

  if (detection.recommendation === 'trigger_fallback' || force) {
    const fallback = await triggerAutoFallback(epicId, 'claude_rate_limited')
    return NextResponse.json({ detection, fallback, autoTriggered: true })
  }

  return NextResponse.json({ detection, fallback: null, autoTriggered: false })
}
