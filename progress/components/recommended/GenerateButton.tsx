'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 抽出を手動実行（定例 11:00/23:00/起動時 と同じ生成ロジックを叩く）。生成は suggested のみ。
export default function GenerateButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/recommended-epics', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg('生成に失敗しました')
        return
      }
      setMsg(`+${data.added} 件（重複スキップ ${data.skipped}）`)
      router.refresh()
    } catch {
      setMsg('通信に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? '抽出中…' : '🔄 抽出実行'}
      </button>
      {msg && <span className="text-[10px] text-gray-400">{msg}</span>}
    </div>
  )
}
