'use client'

import { useState } from 'react'

import type { AppScreenshot, ScreenshotDevicePreset } from '@/lib/app-review-screenshots'

type PanelState = 'idle' | 'capturing' | 'error'

interface ScreenshotPanelProps {
  bundleId: string
  devices: ScreenshotDevicePreset[]
  initialScreenshots: AppScreenshot[]
  /** 入力欄「撮影URL」の現在値。空ならアプリの静的出力を自動配信して撮る。 */
  baseUrl: string
  /** 入力欄「撮影するページ」の現在値（1行1パス）。 */
  routesText: string
}

function fileUrl(bundleId: string, name: string, download: boolean): string {
  const params = new URLSearchParams({ bundleId, name })
  if (download) params.set('download', '1')
  return `/api/app-review-screenshots/file?${params.toString()}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function ScreenshotPanel({ bundleId, devices, initialScreenshots, baseUrl, routesText }: ScreenshotPanelProps) {
  const [screenshots, setScreenshots] = useState<AppScreenshot[]>(initialScreenshots)
  const [deviceId, setDeviceId] = useState<string>(devices[0]?.id ?? 'iphone-6.5')
  const [state, setState] = useState<PanelState>('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  async function capture() {
    setState('capturing')
    setMessage('')
    try {
      const routes = routesText.split('\n').map((route) => route.trim()).filter(Boolean)
      const res = await fetch('/api/app-review-screenshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId, baseUrl, routes, deviceId }),
      })
      const json = (await res.json()) as { success?: boolean; captured?: string[]; baseUrlUsed?: string; screenshots?: AppScreenshot[]; error?: string }
      if (!res.ok || !json.success) throw new Error(json.error ?? '撮影に失敗しました')
      setScreenshots(json.screenshots ?? [])
      setState('idle')
      setMessage(`${json.captured?.length ?? 0}枚を撮影しました（${json.baseUrlUsed}）`)
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  async function refresh() {
    const res = await fetch(`/api/app-review-screenshots?bundleId=${encodeURIComponent(bundleId)}`)
    const json = (await res.json()) as { screenshots?: AppScreenshot[] }
    setScreenshots(json.screenshots ?? [])
  }

  async function remove(name: string) {
    const params = new URLSearchParams({ bundleId, name })
    const res = await fetch(`/api/app-review-screenshots?${params.toString()}`, { method: 'DELETE' })
    const json = (await res.json()) as { success?: boolean; screenshots?: AppScreenshot[]; error?: string }
    if (!res.ok || !json.success) {
      setState('error')
      setMessage(json.error ?? '削除に失敗しました')
      return
    }
    setScreenshots(json.screenshots ?? [])
  }

  // クリップボードへ画像を入れる。非対応ブラウザではダウンロードを案内する。
  async function copyImage(name: string) {
    try {
      const blob = await (await fetch(fileUrl(bundleId, name, false))).blob()
      const ClipboardItemCtor = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      if (!ClipboardItemCtor || !navigator.clipboard?.write) throw new Error('この端末では画像コピーに未対応です。ダウンロードを使ってください')
      await navigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })])
      setCopied(name)
      window.setTimeout(() => setCopied((current) => (current === name ? null : current)), 1600)
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.label}（{device.output.width}×{device.output.height}）
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={capture}
          disabled={state === 'capturing'}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50 dark:bg-blue-500"
        >
          {state === 'capturing' ? '撮影中…' : 'スクショを撮る'}
        </button>
        <button
          type="button"
          onClick={refresh}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-black text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          一覧を更新
        </button>
      </div>

      {message ? (
        <p className={state === 'error'
          ? 'rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200'
          : 'rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700 dark:bg-green-950/40 dark:text-green-200'}>
          {message}
        </p>
      ) : null}

      {screenshots.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400">
          まだ撮影済みのスクリーンショットはありません。「スクショを撮る」でアプリの実画面を撮ると、ここに並んでダウンロードできます。
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {screenshots.map((shot) => (
            <li key={shot.name} className="rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fileUrl(bundleId, shot.name, false)}
                alt={shot.name}
                className="h-40 w-full rounded-lg object-contain"
              />
              <p className="mt-1.5 break-all font-mono text-[10px] font-bold text-gray-600 dark:text-gray-300">{shot.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] font-black">
                <span className={shot.sizeOk ? 'rounded bg-green-100 px-1 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-200' : 'rounded bg-amber-100 px-1 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}>
                  {shot.width}×{shot.height}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{shot.slot ?? 'ASC規定外サイズ'}</span>
                <span className="text-gray-400 dark:text-gray-500">{formatBytes(shot.bytes)}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a
                  href={fileUrl(bundleId, shot.name, true)}
                  download={shot.name}
                  className="rounded-lg bg-blue-600 px-2 py-1 text-[10px] font-black text-white dark:bg-blue-500"
                >
                  ダウンロード
                </a>
                <button
                  type="button"
                  onClick={() => copyImage(shot.name)}
                  className={copied === shot.name
                    ? 'rounded-lg bg-green-600 px-2 py-1 text-[10px] font-black text-white'
                    : 'rounded-lg border border-gray-300 px-2 py-1 text-[10px] font-black text-gray-700 dark:border-gray-700 dark:text-gray-200'}
                >
                  {copied === shot.name ? 'コピー済み' : '画像コピー'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(shot.name)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-[10px] font-black text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
