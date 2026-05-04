'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  initialText: string
}

export default function HandoffEditor({ initialText }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [, startTransition] = useTransition()

  async function save() {
    setSaving(true)
    await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handoffText: text }),
    })
    setSaving(false)
    startTransition(() => router.refresh())
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">次回への引き継ぎ</h2>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        今日の作業が終わったら、次回の Claude Code に渡す引き継ぎ内容を入力してください。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="次回のClaude Codeへの引き継ぎ内容..."
        rows={5}
        className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          onClick={copy}
          className="flex-1 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
        >
          {copied ? '✓ コピー済み' : 'コピー'}
        </button>
      </div>
    </div>
  )
}
