'use client'

import { useCallback, useEffect, useState } from 'react'

// 開発者モード（localStorage ベース・新正本ではない単なる表示スイッチ）。
// ON のときだけ手動 Codex 引き継ぎ / 手動 executor 選択 / AutoFallback 手動上書きを表示する。
// 通常ユーザーは Executor を意識しない（状態中心 UI）。
const KEY = 'progressDevMode'
const EVENT = 'progress-devmode-change'

export function useDevMode(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const read = () => setOn(typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1')
    read()
    window.addEventListener('storage', read)
    window.addEventListener(EVENT, read)
    return () => {
      window.removeEventListener('storage', read)
      window.removeEventListener(EVENT, read)
    }
  }, [])

  const set = useCallback((v: boolean) => {
    window.localStorage.setItem(KEY, v ? '1' : '0')
    window.dispatchEvent(new Event(EVENT))
    setOn(v)
  }, [])

  return [on, set]
}
