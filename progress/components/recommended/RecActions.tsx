'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RecommendationStatus, RecommendationKind } from '@/types/recommended-epic'

// 承認してEpic追加 / 保留 / 却下 / 再調査。承認のみ epics.json へ追記（人間操作のみ・自動Epic追加なし）。
export default function RecActions({
  id,
  status,
  kind,
  duplicate,
  createdEpicId,
}: {
  id: string
  status: RecommendationStatus
  kind: RecommendationKind
  duplicate: boolean
  createdEpicId?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const done = status === 'epic_created'

  async function setStatus(next: RecommendationStatus, label: string) {
    setBusy(label)
    setMsg(null)
    try {
      const res = await fetch(`/api/recommended-epics/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, detail: `UIから${label}` }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg({ kind: 'err', text: data.error || '更新に失敗しました' })
        return
      }
      setMsg({ kind: 'ok', text: `${label}に更新しました` })
      router.refresh()
    } catch {
      setMsg({ kind: 'err', text: '通信に失敗しました' })
    } finally {
      setBusy(null)
    }
  }

  async function approve() {
    const label = kind === 'new_epic' ? '新規 Epic を epics.json に追加' : '既存 Epic に Next Action を追記'
    if (!confirm(`承認すると${label}します。よろしいですか？`)) return
    setBusy('承認')
    setMsg(null)
    try {
      const res = await fetch(`/api/recommended-epics/${id}/approve`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setMsg({ kind: 'err', text: data.reason || data.error || '承認に失敗しました' })
        return
      }
      setMsg({ kind: 'ok', text: data.epicId ? `Epic追加: ${data.epicId}` : `既存Epic追記: ${data.updatedEpicId}` })
      router.refresh()
    } catch {
      setMsg({ kind: 'err', text: '通信に失敗しました' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">承認フロー</h2>

      {done ? (
        <p className="text-sm text-violet-600 dark:text-violet-400">
          Epic化済み{createdEpicId ? `（${createdEpicId}）` : ''}。二重登録は防止されます。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setStatus('hold', '保留')}
              disabled={!!busy}
              className="rounded-xl border border-amber-300 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300"
            >
              {busy === '保留' ? '…' : '保留'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('rejected', '却下')}
              disabled={!!busy}
              className="rounded-xl border border-rose-300 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300"
            >
              {busy === '却下' ? '…' : '却下'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('suggested', '再調査')}
              disabled={!!busy}
              className="rounded-xl border border-indigo-300 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
            >
              {busy === '再調査' ? '…' : '再調査'}
            </button>
          </div>
          {duplicate && (
            <p className="mt-2 text-xs font-semibold text-rose-600">⚠ 重複ありのため承認時にブロックされます（先に重複を解消してください）。</p>
          )}
          <button
            type="button"
            onClick={approve}
            disabled={!!busy}
            className="mt-2 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy === '承認' ? '処理中…' : '✅ 承認してEpic追加'}
          </button>
          <p className="mt-1.5 text-[11px] text-gray-400">
            承認した時のみ epics.json へ追加します（自動Epic追加なし）。重複・二重登録は自動ブロック。
          </p>
        </>
      )}

      {msg && <p className={`mt-2 text-xs font-semibold ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>}
    </section>
  )
}
