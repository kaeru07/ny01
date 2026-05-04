'use client'

import { useState } from 'react'

interface Props {
  taskId: string
  projectId: string
  initialPrompt?: string
}

export default function TaskPromptEditor({ taskId, projectId, initialPrompt }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState(initialPrompt ?? '')
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const hasPrompt = Boolean(value.trim())

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function save() {
    setSaving(true)
    setError('')
    setSavedOk(false)
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, taskPrompt: value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? '保存失敗')
        return
      }
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 2000)
    } catch {
      setError('通信エラー')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${hasPrompt ? 'bg-violet-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
        <span>{hasPrompt ? '専用プロンプトあり' : '専用プロンプトなし'}</span>
        <span className="text-gray-400 dark:text-gray-600">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          <label className="block text-xs text-gray-400 dark:text-gray-500">実行時プロンプト</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="このタスク専用のClaude Code実行指示を入力（空でもOK）"
            rows={4}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
          />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 disabled:opacity-50 transition-colors min-h-[36px]"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            {hasPrompt && (
              <button
                onClick={copyPrompt}
                className="px-4 py-2 rounded-xl border border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 text-xs font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors min-h-[36px]"
              >
                {copied ? '✓ コピーしました' : '📋 プロンプトをコピー'}
              </button>
            )}
            {savedOk && <span className="text-xs text-green-600 dark:text-green-400">保存しました</span>}
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
