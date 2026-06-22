'use client'

import { useRef, useState } from 'react'
import { copyTextToClipboard } from '@/lib/clipboard'

interface ReviewCopyResponse {
  id: string
  title: string
  createdAt: string
  generatedAt: string
  charCount: number
  markdown: string
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error'
type CopyState = 'idle' | 'copied' | 'error'

function formatDate(iso?: string): string {
  if (!iso) return '未記録'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function InboxReviewCopyButton({ runId, all = false }: { runId?: string; all?: boolean }) {
  const [open, setOpen] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const [payload, setPayload] = useState<ReviewCopyResponse | null>(null)
  const [error, setError] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const label = all ? 'レビュー全件コピー' : 'レビュー用コピー'
  const endpoint = all ? '/api/inbox/review-copy' : `/api/inbox/review-copy/${encodeURIComponent(runId ?? '')}`

  async function openModal() {
    if (!all && !runId) return
    setOpen(true)
    setCopyState('idle')
    if (payload || loadState === 'loading') return
    setLoadState('loading')
    setError('')
    try {
      const res = await fetch(endpoint, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as ReviewCopyResponse
      setPayload(json)
      setLoadState('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レビュー用コピーの生成に失敗しました')
      setLoadState('error')
    }
  }

  async function copyAll() {
    if (!payload?.markdown) return
    const ok = await copyTextToClipboard(payload.markdown)
    setCopyState(ok ? 'copied' : 'error')
    if (!ok) {
      setTimeout(() => {
        textRef.current?.focus()
        textRef.current?.select()
      }, 0)
      return
    }
    setTimeout(() => setCopyState('idle'), 2000)
  }

  function closeModal() {
    setOpen(false)
    setCopyState('idle')
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        disabled={!all && !runId}
        className={
          all
            ? 'rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900'
            : 'rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-900/20'
        }
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-300">{label}</p>
                <h2 className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">
                  {payload?.title ?? 'Markdownを準備中'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  ChatGPT/Fableへ貼るレビュー依頼文です。コピーは下のボタン操作で実行します。
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-lg px-2 py-1 text-sm font-bold text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="閉じる"
              >
                x
              </button>
            </div>

            <div className="mt-4">
              {loadState === 'loading' && (
                <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
                  プレビューを準備中です...
                </p>
              )}

              {loadState === 'error' && (
                <p className="rounded-xl bg-red-50 px-3 py-3 text-sm font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">
                  生成に失敗しました: {error}
                </p>
              )}

              {payload && (
                <div className="space-y-3">
                  <dl className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-800/60 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-gray-500 dark:text-gray-400">作成日時</dt>
                      <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{formatDate(payload.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-500 dark:text-gray-400">生成日時</dt>
                      <dd className="mt-0.5 text-gray-900 dark:text-gray-100">{formatDate(payload.generatedAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-gray-500 dark:text-gray-400">文字数</dt>
                      <dd className="mt-0.5 text-gray-900 dark:text-gray-100">約{payload.charCount.toLocaleString('ja-JP')}字</dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={copyAll}
                    className={`w-full rounded-xl px-4 py-3 text-sm font-bold text-white transition-colors ${
                      copyState === 'copied'
                        ? 'bg-green-600'
                        : copyState === 'error'
                          ? 'bg-red-600'
                          : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {copyState === 'copied' ? 'コピー済み' : copyState === 'error' ? 'コピー失敗' : '全体コピー'}
                  </button>

                  <details open className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                    <summary className="cursor-pointer text-xs font-bold text-gray-700 dark:text-gray-200">Markdownプレビュー</summary>
                    <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                      {payload.markdown}
                    </pre>
                  </details>

                  <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                      コピーできない場合は下の全文を選択して手動コピーしてください。
                    </p>
                    <textarea
                      ref={textRef}
                      readOnly
                      value={payload.markdown}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      rows={8}
                      className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
