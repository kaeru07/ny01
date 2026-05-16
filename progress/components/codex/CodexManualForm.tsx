'use client'

import { useState } from 'react'
import CodexTrigger from './CodexTrigger'

export default function CodexManualForm() {
  const [prompt, setPrompt] = useState('')

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
        手動 Codex 実行 (実験)
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        ToDo / Queue を経由せず、任意プロンプトで 1 件試します。read-only サンドボックス固定。
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={5}
        placeholder="codex exec に渡すプロンプト"
        className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
      />
      <CodexTrigger
        prompt={prompt}
        targetTodoTitle="(手動実行)"
      />
    </div>
  )
}
