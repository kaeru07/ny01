'use client'

import { useState } from 'react'

interface Props {
  epicId: string
}

/**
 * 「▶ 続きから実行」ボタン。
 * 押すと内部で ExecutionRun + Decision Log + Next Actions + Approval Queue から
 * 実行コンテキストを生成しクリップボードへコピーする。
 * ユーザーには handoff という内部用語を一切見せない。
 */
export default function ResumeButton({ epicId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  async function resume() {
    setState('loading')
    try {
      const res = await fetch(`/api/operations/handoff?epicId=${encodeURIComponent(epicId)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      const text: string = data?.promptBlock ?? ''
      if (!text) throw new Error('empty')
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const label =
    state === 'loading'
      ? '実行コンテキストを生成中…'
      : state === 'copied'
        ? '✓ コピーしました（Claude / Codex に貼り付け）'
        : state === 'error'
          ? '生成に失敗しました。再試行してください'
          : '▶ 続きから実行'

  return (
    <button
      onClick={resume}
      disabled={state === 'loading'}
      className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
        state === 'error' ? 'bg-red-600' : state === 'copied' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
      }`}
    >
      {label}
    </button>
  )
}
