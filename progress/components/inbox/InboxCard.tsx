'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxItem } from '@/types/inbox'

export default function InboxCard({ item }: { item: InboxItem }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function doImport() {
    setBusy(true)
    setError('')
    setMsg('')
    try {
      const res = await fetch('/api/inbox/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: item.file }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? `失敗 (HTTP ${res.status})`)
        setBusy(false)
        return
      }
      if (data.alreadyImported) {
        setMsg(`取り込み済み (task: ${data.taskId})`)
      } else {
        setMsg(`ToDo化しました → ${data.projectId} / ${data.taskId} (pending_approval)`)
      }
      setBusy(false)
      setConfirming(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message || '通信エラー')
      setBusy(false)
    }
  }

  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        item.imported
          ? 'border-gray-100 dark:border-gray-700 bg-white/60 dark:bg-gray-800/50 opacity-70'
          : 'border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {item.title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
            {item.file}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
            item.imported
              ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          }`}
        >
          {item.imported ? '取込済' : '未取込'}
        </span>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        source: {item.source}
        {item.createdAt ? ` / createdAt: ${item.createdAt}` : ''}
      </p>

      {item.todoCandidates.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
            ToDo候補 ({item.todoCandidates.length})
          </p>
          <ul className="text-xs text-gray-700 dark:text-gray-300 list-disc ml-4 space-y-0.5">
            {item.todoCandidates.slice(0, 8).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-violet-600 dark:text-violet-400">
          本文
        </summary>
        <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-gray-100">
          {item.body}
        </pre>
      </details>

      {item.imported ? (
        <p className="text-xs text-green-700 dark:text-green-300">
          取り込み済み: {item.importedTaskId}{' '}
          {item.importedAt ? `(${item.importedAt.slice(0, 19).replace('T', ' ')})` : ''}
        </p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => {
            setError('')
            setMsg('')
            setConfirming(true)
          }}
          className="px-3 py-1.5 text-xs rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-700 transition-colors"
        >
          ToDo化する
        </button>
      ) : (
        <div className="rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-2">
          <p className="text-xs text-gray-700 dark:text-gray-300">
            project-tasks.json の{' '}
            <span className="font-mono">chatgpt-inbox</span> に{' '}
            <strong>pending_approval</strong>（ユーザー承認待ち）で 1 件追加します。
            Claude は承認まで着手しません。
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={doImport}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-xl bg-violet-600 text-white font-medium disabled:opacity-50 hover:bg-violet-700"
            >
              {busy ? '取り込み中…' : '実行'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {msg && <p className="text-xs text-green-700 dark:text-green-300">{msg}</p>}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
