import { NextResponse } from 'next/server'
import { discoverIosApps, loadCodemagicSecrets, triggerBuild } from '@/lib/ios-builds'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const dir = typeof body?.dir === 'string' ? body.dir.trim() : ''
  if (!dir) {
    return NextResponse.json({ success: false, error: 'dir is required' }, { status: 400 })
  }

  const apps = discoverIosApps()
  if (!apps.some((app) => app.dir === dir)) {
    return NextResponse.json({ success: false, error: '対象アプリが見つかりません' }, { status: 404 })
  }

  const secrets = loadCodemagicSecrets()
  if (!secrets.ready) {
    return NextResponse.json({ success: false, error: secrets.reason ?? 'Codemagicトークン未配置' }, { status: 400 })
  }

  const result = await triggerBuild(dir)
  if (!result.success) {
    return NextResponse.json(result, { status: 502 })
  }
  return NextResponse.json(result)
}
