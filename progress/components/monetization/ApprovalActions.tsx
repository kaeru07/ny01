'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateStatus } from '@/types/monetization'

// 承認フロー: 保留 / 却下 / 再調査 / Epic化。Epic化のみ人間が押した時に正式 Epic を作る（自動Epic化禁止）。
export default function ApprovalActions({
  id,
  status,
  linkEpicId,
}: {
  id: string
  status: CandidateStatus
  linkEpicId?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const alreadyEpic = status === 'EpicCreated' || status === 'Building' || status === 'Released'

  async function setStatus(next: CandidateStatus, label: string) {
    setBusy(label)
    setMsg(null)
    try {
      const res = await fetch(`/api/monetization/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', status: next, detail: `UIから${label}` }),
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

  async function promote() {
    if (!confirm('この候補を正式 Epic として Factory に登録します。よろしいですか？')) return
    setBusy('Epic化')
    setMsg(null)
    try {
      const res = await fetch(`/api/monetization/${id}/promote`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        // 重複(409)などはブロック理由を表示
        setMsg({ kind: 'err', text: data.reason || data.error || 'Epic化に失敗しました' })
        return
      }
      setMsg({ kind: 'ok', text: `Epic化しました: ${data.epicId}` })
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

      {alreadyEpic ? (
        <p className="text-sm text-violet-600 dark:text-violet-400">
          この候補は <span className="font-semibold">{status}</span> です
          {linkEpicId && <>（Epic: {linkEpicId}）</>}。Epic化は完了しています。
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus('Hold', '保留')}
              disabled={!!busy}
              className="rounded-xl border border-amber-300 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300"
            >
              {busy === '保留' ? '…' : '保留'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('Rejected', '却下')}
              disabled={!!busy}
              className="rounded-xl border border-rose-300 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-300"
            >
              {busy === '却下' ? '…' : '却下'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('Review', '再調査')}
              disabled={!!busy}
              className="rounded-xl border border-indigo-300 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-700 dark:text-indigo-300"
            >
              {busy === '再調査' ? '…' : '再調査'}
            </button>
            <button
              type="button"
              onClick={() => setStatus('Approved', '承認')}
              disabled={!!busy}
              className="rounded-xl border border-emerald-300 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300"
            >
              {busy === '承認' ? '…' : '承認(Approved)'}
            </button>
          </div>
          <button
            type="button"
            onClick={promote}
            disabled={!!busy}
            className="mt-2 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy === 'Epic化' ? 'Epic化中…' : '🏭 Epic化して Factory に登録'}
          </button>
          <p className="mt-1.5 text-[11px] text-gray-400">
            Epic化を押した時のみ正式 Epic を作成します（自動Epic化なし）。重複は自動でブロックされます。
          </p>
        </>
      )}

      {msg && (
        <p className={`mt-2 text-xs font-semibold ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>{msg.text}</p>
      )}
    </section>
  )
}
