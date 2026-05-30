import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const run = promisify(exec)

const ALLOWED_ACTIONS = ['start', 'stop', 'restart'] as const
type Action = (typeof ALLOWED_ACTIONS)[number]

interface Pm2Proc {
  name?: string
  pm2_env?: { status?: string }
  monit?: { cpu?: number; memory?: number }
}

async function listProcesses(): Promise<Pm2Proc[]> {
  const { stdout } = await run('pm2 jlist')
  try {
    return JSON.parse(stdout) as Pm2Proc[]
  } catch {
    return []
  }
}

// VLOOP_PM2_NAME が設定されていればそれを優先。未設定時は pm2 一覧から名前に
// 'vloop' を含むプロセスを推定する。
async function resolveProcessName(procs: Pm2Proc[]): Promise<string | null> {
  const configured = process.env.VLOOP_PM2_NAME
  if (configured) return configured
  const guessed = procs.find((p) => (p.name ?? '').toLowerCase().includes('vloop'))
  return guessed?.name ?? null
}

export async function GET() {
  try {
    const procs = await listProcesses()
    const name = await resolveProcessName(procs)
    if (!name) {
      return NextResponse.json({ name: null, status: 'not_found' })
    }
    const proc = procs.find((p) => p.name === name)
    return NextResponse.json({
      name,
      status: proc?.pm2_env?.status ?? 'not_found',
      cpu: proc?.monit?.cpu ?? null,
      memory: proc?.monit?.memory ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { name: null, status: 'error', error: String(err) },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const action = body?.action as Action | undefined

  if (!action || !ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json(
      { success: false, error: `action must be one of ${ALLOWED_ACTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const procs = await listProcesses()
    const name = await resolveProcessName(procs)
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'vloop process not found' },
        { status: 404 },
      )
    }

    await run(`pm2 ${action} ${name}`)

    // 実行後の最新状態を返す
    const after = await listProcesses()
    const proc = after.find((p) => p.name === name)
    return NextResponse.json({
      success: true,
      name,
      action,
      status: proc?.pm2_env?.status ?? 'unknown',
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 },
    )
  }
}
