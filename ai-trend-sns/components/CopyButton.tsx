'use client'

import { useState } from 'react'

export default function CopyButton({ text, label = 'コピー' }: { text: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setState('copied')
    } catch {
      setState('error')
    } finally {
      setTimeout(() => setState('idle'), 1800)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        state === 'copied'
          ? 'bg-emerald-600 text-white'
          : state === 'error'
          ? 'bg-red-600 text-white'
          : 'bg-ink text-white hover:bg-slate-700'
      }`}
    >
      {state === 'copied' ? 'コピー済み' : state === 'error' ? '失敗' : label}
    </button>
  )
}
