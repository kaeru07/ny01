import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { createReadStream } from 'node:fs'

import { chromium } from 'playwright-core'

import { getIosSigningGuideApps } from './ios-signing-guide'

// ─────────────────────────────────────────────────────────────
// 審査提出用スクリーンショット（/app-review-fields の「プレビューとスクリーンショット」）
//
// App Store Connect にアップロードする実機サイズのスクリーンショットを、
// アプリを実際にヘッドレスブラウザで開いて撮影し、ダウンロードできるようにする。
// 保存先は各アプリの fastlane/screenshots/ja（fastlane deliver の標準配置）。
//
// 撮影対象URLは、画面で指定があればそれを使い、無ければアプリの静的出力（out/）を
// 一時的なローカルサーバーで配信して撮る（pm2 のプレビュー起動に依存しない）。
// ─────────────────────────────────────────────────────────────

export interface ScreenshotDevicePreset {
  id: string
  label: string
  /** ブラウザのビューポート（CSSピクセル）。 */
  viewport: { width: number; height: number }
  /** 端末解像度に合わせる倍率。viewport × scale が出力ピクセル。 */
  scale: number
  /** App Store Connect が受け付ける出力サイズ。 */
  output: { width: number; height: number }
}

export const SCREENSHOT_DEVICES: ScreenshotDevicePreset[] = [
  { id: 'iphone-6.5', label: 'iPhone 6.5インチ', viewport: { width: 428, height: 926 }, scale: 3, output: { width: 1284, height: 2778 } },
  { id: 'ipad-13', label: 'iPad 13インチ', viewport: { width: 1032, height: 1376 }, scale: 2, output: { width: 2064, height: 2752 } },
]

/** ASC が受け付けるサイズと、どのディスプレイ枠に入れられるか。判定バッジに使う。 */
const ACCEPTED_SIZES: Array<{ width: number; height: number; slot: string }> = [
  { width: 1242, height: 2688, slot: '6.5インチ' },
  { width: 2688, height: 1242, slot: '6.5インチ（横）' },
  { width: 1284, height: 2778, slot: '6.5インチ' },
  { width: 2778, height: 1284, slot: '6.5インチ（横）' },
  { width: 1290, height: 2796, slot: '6.9/6.7インチ' },
  { width: 2796, height: 1290, slot: '6.9/6.7インチ（横）' },
  { width: 1320, height: 2868, slot: '6.9インチ' },
  { width: 2868, height: 1320, slot: '6.9インチ（横）' },
  { width: 2064, height: 2752, slot: 'iPad 13インチ' },
  { width: 2752, height: 2064, slot: 'iPad 13インチ（横）' },
  { width: 2048, height: 2732, slot: 'iPad 12.9インチ' },
  { width: 2732, height: 2048, slot: 'iPad 12.9インチ（横）' },
]

export interface AppScreenshot {
  name: string
  width: number
  height: number
  bytes: number
  updatedAt: string
  /** ASC が受け付けるサイズか。 */
  sizeOk: boolean
  /** 受け付ける場合、どのディスプレイ枠に入れられるか。 */
  slot: string | null
}

/** fastlane deliver の配置。直下と言語サブフォルダ（ja など）の両方を対象にする。 */
function screenshotsRoot(appDir: string): string {
  return path.join(appDir, 'fastlane', 'screenshots')
}

/** 撮影したファイルの保存先。 */
function captureDir(appDir: string): string {
  return path.join(screenshotsRoot(appDir), 'ja')
}

function findApp(bundleId: string) {
  const app = getIosSigningGuideApps().find((item) => item.bundleId === bundleId)
  if (!app) throw new Error(`未知の bundleId です: ${bundleId}`)
  return app
}

/** PNG ヘッダから幅・高さを読む（画像ライブラリを増やさないため自前で読む）。 */
function readPngSize(buffer: Buffer): { width: number; height: number } {
  const isPng = buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47
  if (!isPng) return { width: 0, height: 0 }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

/** 一覧が返す name は screenshots ルートからの相対パス（例: ja/xxx.png / 6.5_1_input.png）。 */
function isSafeName(name: string): boolean {
  return /^[\w.-]+(\/[\w.-]+)?\.png$/i.test(name) && !name.split('/').includes('..')
}

export async function listAppScreenshots(bundleId: string): Promise<AppScreenshot[]> {
  const app = findApp(bundleId)
  const dir = screenshotsRoot(app.appDir)

  const names: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        names.push(entry.name)
        continue
      }
      // 言語サブフォルダ（ja / en-US など）配下も1階層だけ見る。
      if (!entry.isDirectory()) continue
      try {
        const children = await fs.readdir(path.join(dir, entry.name))
        for (const child of children) {
          if (child.toLowerCase().endsWith('.png')) names.push(`${entry.name}/${child}`)
        }
      } catch {
        // 読めないフォルダは飛ばす
      }
    }
  } catch {
    return []
  }

  const shots: AppScreenshot[] = []
  for (const name of names.sort()) {
    const filePath = path.join(dir, name)
    try {
      const [stat, buffer] = await Promise.all([fs.stat(filePath), fs.readFile(filePath)])
      const { width, height } = readPngSize(buffer)
      const accepted = ACCEPTED_SIZES.find((size) => size.width === width && size.height === height)
      shots.push({
        name,
        width,
        height,
        bytes: stat.size,
        updatedAt: stat.mtime.toISOString(),
        sizeOk: Boolean(accepted),
        slot: accepted?.slot ?? null,
      })
    } catch {
      // 読めないファイルは一覧から落とす
    }
  }
  return shots
}

/** ダウンロード用にファイル本体を返す。ディレクトリ外への参照は弾く。 */
export function openAppScreenshot(bundleId: string, name: string) {
  if (!isSafeName(name)) throw new Error('ファイル名が不正です')
  const app = findApp(bundleId)
  const dir = screenshotsRoot(app.appDir)
  const filePath = path.resolve(path.join(dir, name))
  if (!filePath.startsWith(`${path.resolve(dir)}${path.sep}`)) throw new Error('ファイル名が不正です')
  return { filePath, stream: () => createReadStream(filePath) }
}

export async function deleteAppScreenshot(bundleId: string, name: string): Promise<void> {
  const { filePath } = openAppScreenshot(bundleId, name)
  await fs.rm(filePath, { force: true })
}

const STATIC_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

/** アプリの静的出力（out/）を一時的に配信する。撮影が終わったら close する。 */
async function serveStaticOut(outDir: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = http.createServer(async (req, res) => {
    try {
      const requested = decodeURIComponent((req.url ?? '/').split('?')[0])
      const relative = requested.replace(/^\/+/, '')
      const candidates = [
        path.join(outDir, relative),
        path.join(outDir, relative, 'index.html'),
        path.join(outDir, `${relative.replace(/\/$/, '')}.html`),
      ]
      for (const candidate of candidates) {
        if (!path.resolve(candidate).startsWith(path.resolve(outDir))) continue
        try {
          const stat = await fs.stat(candidate)
          if (!stat.isFile()) continue
          const body = await fs.readFile(candidate)
          res.writeHead(200, { 'Content-Type': STATIC_CONTENT_TYPES[path.extname(candidate).toLowerCase()] ?? 'application/octet-stream' })
          res.end(body)
          return
        } catch {
          // 次の候補へ
        }
      }
      res.writeHead(404).end('not found')
    } catch {
      res.writeHead(500).end('error')
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

export interface CaptureInput {
  bundleId: string
  /** 撮影対象のベースURL。未指定ならアプリの out/ を一時配信する。 */
  baseUrl?: string
  /** 撮影するパス。未指定なら "/" のみ。 */
  routes?: string[]
  /** SCREENSHOT_DEVICES の id。未指定なら iPhone 6.5インチ。 */
  deviceId?: string
}

export interface CaptureResult {
  captured: string[]
  baseUrlUsed: string
  device: ScreenshotDevicePreset
  screenshots: AppScreenshot[]
}

function routeToSlug(route: string, index: number): string {
  const cleaned = route.replace(/[^\w/-]/g, '').replace(/^\/+|\/+$/g, '').replace(/\//g, '-')
  return `${String(index + 1).padStart(2, '0')}-${cleaned || 'top'}`
}

/**
 * 実際にアプリをヘッドレスブラウザで開いて、ASC のサイズでスクリーンショットを撮る。
 * 生成物ではなく実画面の撮影。撮った PNG は fastlane/screenshots/ja に保存する。
 */
export async function captureAppScreenshots(input: CaptureInput): Promise<CaptureResult> {
  const app = findApp(input.bundleId)
  const device = SCREENSHOT_DEVICES.find((item) => item.id === (input.deviceId ?? 'iphone-6.5'))
  if (!device) throw new Error(`未知の端末サイズです: ${input.deviceId}`)

  const routes = (input.routes && input.routes.length > 0 ? input.routes : ['/'])
    .map((route) => route.trim())
    .filter(Boolean)
    .map((route) => (route.startsWith('/') ? route : `/${route}`))
  if (routes.length > 10) throw new Error('一度に撮れるのは10枚までです')

  const explicitUrl = input.baseUrl?.trim()
  if (explicitUrl && !/^https?:\/\//.test(explicitUrl)) throw new Error('撮影URLは http:// または https:// で指定してください')

  let baseUrl = explicitUrl ?? ''
  let stopServer: (() => Promise<void>) | null = null
  if (!baseUrl) {
    const outDir = path.join(app.appDir, 'out')
    try {
      await fs.access(path.join(outDir, 'index.html'))
    } catch {
      throw new Error('撮影URLが未設定で、静的出力（out/index.html）も見つかりません。撮影URLを入力するか、先にアプリをビルドしてください')
    }
    const served = await serveStaticOut(outDir)
    baseUrl = served.origin
    stopServer = served.close
  }

  const dir = captureDir(app.appDir)
  await fs.mkdir(dir, { recursive: true })

  const browser = await chromium.launch()
  const captured: string[] = []
  try {
    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.scale,
      isMobile: device.id.startsWith('iphone'),
      hasTouch: device.id.startsWith('iphone'),
    })
    const page = await context.newPage()

    for (let index = 0; index < routes.length; index += 1) {
      const route = routes[index]
      const url = `${baseUrl.replace(/\/$/, '')}${route}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
      await page.waitForTimeout(600)
      const name = `${device.id}-${routeToSlug(route, index)}.png`
      await page.screenshot({ path: path.join(dir, name), fullPage: false })
      captured.push(`ja/${name}`)
    }
    await context.close()
  } finally {
    await browser.close()
    if (stopServer) await stopServer()
  }

  return { captured, baseUrlUsed: baseUrl, device, screenshots: await listAppScreenshots(input.bundleId) }
}
