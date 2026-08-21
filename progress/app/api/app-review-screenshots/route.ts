import { NextResponse } from 'next/server'
import {
  captureAppScreenshots,
  deleteAppScreenshot,
  listAppScreenshots,
  SCREENSHOT_DEVICES,
} from '@/lib/app-review-screenshots'

export const dynamic = 'force-dynamic'
// 実ブラウザ撮影のため既定のタイムアウトでは足りない。
export const maxDuration = 300

// 保存済みスクリーンショットの一覧を返す。
export async function GET(request: Request) {
  const bundleId = new URL(request.url).searchParams.get('bundleId')
  if (!bundleId) return NextResponse.json({ error: 'bundleId は必須です' }, { status: 400 })

  try {
    return NextResponse.json({ screenshots: await listAppScreenshots(bundleId), devices: SCREENSHOT_DEVICES })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

// アプリを実際にヘッドレスブラウザで開いて撮影する。
export async function POST(request: Request) {
  let body: { bundleId?: unknown; baseUrl?: unknown; routes?: unknown; deviceId?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'JSON の形式が不正です' }, { status: 400 })
  }

  if (typeof body.bundleId !== 'string' || !body.bundleId.trim()) {
    return NextResponse.json({ error: 'bundleId は必須です' }, { status: 400 })
  }

  try {
    const result = await captureAppScreenshots({
      bundleId: body.bundleId,
      baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
      routes: Array.isArray(body.routes) ? body.routes.filter((route): route is string => typeof route === 'string') : undefined,
      deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

// 撮り直し用に1枚削除する。
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams
  const bundleId = params.get('bundleId')
  const name = params.get('name')
  if (!bundleId || !name) return NextResponse.json({ error: 'bundleId と name は必須です' }, { status: 400 })

  try {
    await deleteAppScreenshot(bundleId, name)
    return NextResponse.json({ success: true, screenshots: await listAppScreenshots(bundleId) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
