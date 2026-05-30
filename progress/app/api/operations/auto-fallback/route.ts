import { NextResponse } from 'next/server'
import { triggerAutoFallback } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

// Claude 上限扱いになったときに呼ぶ。安全判定 → 安全なら Codex プロンプト生成 → Automation Log 追記。
// Codex は自動起動しない（プロンプト生成と通知のみ）。
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const epicId = typeof body?.epicId === 'string' && body.epicId.trim() ? body.epicId.trim() : undefined
  const reason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : 'claude_rate_limited'
  const result = await triggerAutoFallback(epicId, reason)
  return NextResponse.json(result)
}
