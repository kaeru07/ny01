'use client'

import { useRef, useState } from 'react'

interface CopyButtonProps {
  text: string
  label?: string
}

export default function CopyButton({ text, label = 'コピー' }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const resetTimer = useRef<number | null>(null)

  function copyWithTextarea() {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    try {
      return document.execCommand('copy')
    } finally {
      textarea.remove()
    }
  }

  function showResult(result: 'copied' | 'error') {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current)
    }
    setState(result)
    resetTimer.current = window.setTimeout(() => {
      setState('idle')
      resetTimer.current = null
    }, 1600)
  }

  async function copy() {
    try {
      if (window.isSecureContext && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else if (!copyWithTextarea()) {
        throw new Error('copy command failed')
      }
      showResult('copied')
    } catch {
      try {
        if (!copyWithTextarea()) {
          throw new Error('copy command failed')
        }
        showResult('copied')
      } catch {
        showResult('error')
      }
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
