'use client'

import { useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
}

export default function CopyButton({ text, label = 'コピー' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setState('copied')
        window.setTimeout(() => setState('idle'), 1600)
        return
      }
      throw new Error('clipboard unavailable')
    } catch {
      setState('error')
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        state === 'copied'
          ? 'rounded-lg bg-green-600 px-3 py-1.5 text-xs font-black text-white'
          : state === 'error'
            ? 'rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-black text-white'
            : 'rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400'
      }
    >
      {state === 'copied' ? 'コピー済み' : state === 'error' ? '手動コピー' : label}
    </button>
  )
}
