'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// progress の使用状況トラッカー。layout に1つだけ常駐させる。
// - 画面遷移（page_view）: usePathname の変化を記録
// - ボタン操作（action）: document 全体の click を委譲監視し、button / [role=button] のクリックだけ記録
// 個別画面・個別ボタンの改修は不要（横断キャプチャ）。表示専用ログで実行ロジックには一切影響しない。
//
// 記録を抑止したい要素には data-usage-ignore を付ける。
// ボタン文言の代わりに残したいラベルがあれば data-usage-label を付ける。

function send(payload: { type: 'page_view' | 'action'; path: string; label?: string }) {
  try {
    const body = JSON.stringify(payload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/usage', new Blob([body], { type: 'application/json' }))
      return
    }
    void fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* 記録失敗は握りつぶす（使用ログは本機能の副作用であり画面動作を止めない） */
  }
}

export default function UsageTracker() {
  const pathname = usePathname()
  const lastPath = useRef<string | null>(null)

  // 画面遷移を記録
  useEffect(() => {
    if (!pathname) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    send({ type: 'page_view', path: pathname })
  }, [pathname])

  // ボタン操作を記録（委譲・capture phase）
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const start = e.target as HTMLElement | null
      if (!start || typeof start.closest !== 'function') return
      if (start.closest('[data-usage-ignore]')) return
      const el = start.closest('button, [role="button"]') as HTMLElement | null
      if (!el) return
      const raw = el.getAttribute('data-usage-label') || el.textContent || ''
      const label = raw.trim().replace(/\s+/g, ' ').slice(0, 80)
      if (!label) return
      send({ type: 'action', path: window.location.pathname, label })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return null
}
