'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddCandidateButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [score, setScore] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) {
      setError('候補名は必須です')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/monetization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || '未分類',
          score: score ? Number(score) : 0,
          notes: notes.trim() || undefined,
          status: 'Candidate',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setError(data.error || '作成に失敗しました')
        return
      }
      setOpen(false)
      setName('')
      setCategory('')
      setScore('')
      setNotes('')
      router.refresh()
    } catch {
      setError('通信に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        ＋候補追加
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md space-y-3 rounded-t-2xl bg-white p-4 dark:bg-gray-900 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">収益化候補を追加</h2>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500">候補名 *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 野鳥観察ノート BirdLog"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-800"
              />
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500">カテゴリ</label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="記録 / 学習 / 趣味…"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-semibold text-gray-500">スコア</label>
                  <input
                    value={score}
                    onChange={(e) => setScore(e.target.value)}
                    inputMode="numeric"
                    placeholder="0-100"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
              </div>
              <label className="block text-xs font-semibold text-gray-500">一言メモ</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? '追加中…' : '追加する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
