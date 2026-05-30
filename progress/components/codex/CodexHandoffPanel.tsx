'use client'

import { useState } from 'react'
import type { CodexPrompt } from '@/lib/types/operations'

interface Props {
  /** 省略時は全体（現在のコンテキスト）から生成 */
  epicId?: string
}

/**
 * 「Codexへ引き継ぐ」パネル。Claude 上限時にユーザーがモバイルでコピーし Codex へ貼る。
 * 生成されるのは単一プレーンテキスト（安全判定付き）。handoff という内部名は出さない。
 */
export default function CodexHandoffPanel({ epicId }: Props) {
  const [data, setData] = useState<CodexPrompt | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  async function generate() {
    setState('loading')
    try {
      const url = epicId ? `/api/operations/codex-prompt?epicId=${encodeURIComponent(epicId)}` : '/api/operations/codex-prompt'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      setData(await res.json())
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  async function copy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.promptText)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <button
        onClick={generate}
        disabled={state === 'loading'}
        className="w-full rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-900/20"
      >
        {state === 'loading' ? '生成中…' : state === 'error' ? '生成に失敗。再試行' : '🤝 Codexへ引き継ぐ'}
      </button>

      {data && (
        <div className="mt-3 space-y-2">
          {/* 生成元情報 */}
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {data.meta.epicTitle && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Epic: {data.meta.epicTitle}</span>}
            {data.meta.sourceRunId && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">元Run: {data.meta.sourceRunId}</span>}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">次やること: {data.meta.nextActionsCount}件</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">承認待ち: {data.meta.approvalsPending}件</span>
            {data.meta.hasSafetyGuard && <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-300">✓ 安全判定付き</span>}
          </div>

          <button
            onClick={copy}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors ${state === 'copied' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {state === 'copied' ? '✓ コピーしました（Codexへ貼り付け）' : 'プロンプトをコピー'}
          </button>

          {/* コピー用表示：単一ブロック・入れ子コードフェンスなし */}
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-800/50 dark:text-gray-300">
{data.promptText}
          </pre>
        </div>
      )}
    </div>
  )
}
