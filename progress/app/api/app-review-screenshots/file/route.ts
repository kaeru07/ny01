import fs from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { openAppScreenshot } from '@/lib/app-review-screenshots'

export const dynamic = 'force-dynamic'

// スクリーンショット1枚を返す。?download=1 でダウンロード（添付）扱いにする。
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const bundleId = params.get('bundleId')
  const name = params.get('name')
  if (!bundleId || !name) return NextResponse.json({ error: 'bundleId と name は必須です' }, { status: 400 })

  try {
    const { filePath } = openAppScreenshot(bundleId, name)
    const body = await fs.readFile(filePath)
    const disposition = params.get('download') === '1' ? 'attachment' : 'inline'
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(name)}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'ファイルが見つかりません' : (err as Error).message
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
