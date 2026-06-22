import { NextResponse } from 'next/server'
import { runScheduledFactory } from '@/lib/factory-schedule'
import type { ScheduleSource, ScheduleTrigger } from '@/lib/factory-schedule'

export const dynamic = 'force-dynamic'

const VALID_SOURCES: ScheduleSource[] = ['schedule', 'boot']
const VALID_TRIGGERS: ScheduleTrigger[] = ['systemd', 'cron', 'startup']

// POST: スケジューラ（systemd timer / cron / boot service）から Factory を起動する入口。
//   body: { source: 'schedule'|'boot', trigger: 'systemd'|'cron'|'startup', maxRuns?, maxPerEpic? }
//   - factoryEnabled=false → 何も起動しない（skip=factory_off）
//   - 各Runnerが自分の候補・安全条件を判定する（グローバルな合成状態では止めない）
//   - 実行中（lock 有効）→ 起動しない（skip=already_running）
//   - 上記以外は runFactory(auto) を起動し、各 Run に source/trigger を付与 + envelope を記録。
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const source: ScheduleSource = VALID_SOURCES.includes(body?.source) ? body.source : 'schedule'
  const trigger: ScheduleTrigger = VALID_TRIGGERS.includes(body?.trigger) ? body.trigger : 'systemd'

  const result = await runScheduledFactory({
    source,
    trigger,
    maxRuns: typeof body?.maxRuns === 'number' ? body.maxRuns : undefined,
    maxPerEpic: typeof body?.maxPerEpic === 'number' ? body.maxPerEpic : undefined,
    // テスト用に runFactory の simulate* / cwd を素通しする（本番スケジューラからは渡さない）。
    passthrough:
      body?.passthrough && typeof body.passthrough === 'object' ? body.passthrough : undefined,
  })

  return NextResponse.json(result)
}
