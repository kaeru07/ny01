'use client'

import { useState } from 'react'
import type { PromptCopyButton } from '@/types/ai-drive'
import { copyTextToClipboard } from '@/lib/clipboard'

interface PromptCopyButtonsProps {
  buttons: PromptCopyButton[]
}

export default function PromptCopyButtons({ buttons }: PromptCopyButtonsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  async function handleCopy(btn: PromptCopyButton) {
    setErrorId(null)
    const ok = await copyTextToClipboard(btn.mockPromptText)
    if (ok) {
      setCopiedId(btn.id)
      setTimeout(() => setCopiedId(null), 1800)
    } else {
      setErrorId(btn.id)
      setTimeout(() => setErrorId(null), 1800)
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">プロンプトコピー操作</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        各ボタンの本文は v1 モック。将来 Vault / ゴール状態から動的生成する想定。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {buttons.map((btn) => {
          const isCopied = copiedId === btn.id
          const isError = errorId === btn.id
          return (
            <button
              key={btn.id}
              onClick={() => handleCopy(btn)}
              className={`text-left rounded-xl border p-3 transition-colors active:scale-[0.99] ${
                isCopied
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                  : isError
                    ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {btn.label}
                </div>
                <span
                  className={`text-[11px] flex-shrink-0 ${
                    isCopied
                      ? 'text-green-700 dark:text-green-300 font-bold'
                      : isError
                        ? 'text-red-700 dark:text-red-300 font-bold'
                        : 'text-blue-500 dark:text-blue-400'
                  }`}
                >
                  {isCopied ? '✓ コピーした' : isError ? '✗ 失敗' : 'コピー'}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {btn.description}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
