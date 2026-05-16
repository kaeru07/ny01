'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CodexRun } from '@/types/codex-run'

interface Props {
  prompt: string
  targetTodoId?: string
  targetTodoTitle?: string
  queueItemId?: string
  projectId?: string
  projectName?: string
  compact?: boolean
  onDone?: (run: CodexRun) => void
}

export default function CodexTrigger({
  prompt,
  targetTodoId,
  targetTodoTitle,
  queueItemId,
  projectId,
  projectName,
  compact,
  onDone,
}: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CodexRun | null>(null)

  const trimmed = (prompt ?? '').trim()
  const disabled = !trimmed || running

  async function execute() {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/codex/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          targetTodoId,
          targetTodoTitle,
          queueItemId,
          projectId,
          projectName,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? `失敗 (HTTP ${res.status})`)
        setRunning(false)
        setConfirming(false)
        return
      }
      setResult(data.run as CodexRun)
      setConfirming(false)
      setRunning(false)
      onDone?.(data.run as CodexRun)
      router.refresh()
    } catch (e) {
      setError((e as Error).message || '通信エラー')
      setRunning(false)
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-2">
      {!confirming && (
        <button
          type="button"
          onClick={() => {
            setError('')
            setResult(null)
            setConfirming(true)
          }}
          disabled={disabled}
          className={`${
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          } rounded-xl bg-violet-600 text-white font-medium disabled:opacity-40 hover:bg-violet-700 transition-colors`}
          title={!trimmed ? 'プロンプトが空です' : 'Codex CLI で1件実行します'}
        >
          Codexで試す
        </button>
      )}

      {confirming && (
        <div className="rounded-xl border border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/20 p-3 space-y-2">
          <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">
            Codex 実行の確認
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            codex CLI を <span className="font-mono">read-only</span> サンドボックスで
            <strong>1件のみ</strong>実行します。自動ループ・並列実行はしません。
          </p>
          {targetTodoTitle && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              対象: {targetTodoTitle}
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-violet-700 dark:text-violet-300">
              送信プロンプトを確認 ({trimmed.length} 文字)
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-gray-100">
              {trimmed}
            </pre>
          </details>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={execute}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded-xl bg-violet-600 text-white font-medium disabled:opacity-50 hover:bg-violet-700 transition-colors"
            >
              {running ? '実行中…' : '実行する'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={running}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">{error}</p>
      )}

      {result && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-1 text-xs">
          <p className="font-semibold text-gray-800 dark:text-gray-100">
            実行結果: <span className="font-mono">{result.status}</span>{' '}
            (exit {result.exitCode ?? 'null'} / {result.durationMs}ms)
          </p>
          <p className="text-gray-500 dark:text-gray-400 font-mono">{result.runId}</p>
          {result.stdout && (
            <details>
              <summary className="cursor-pointer text-violet-700 dark:text-violet-300">
                stdout
              </summary>
              <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-gray-100">
                {result.stdout}
                {result.stdoutTruncated ? '\n...(truncated)' : ''}
              </pre>
            </details>
          )}
          {result.stderr && (
            <details>
              <summary className="cursor-pointer text-red-600 dark:text-red-400">
                stderr
              </summary>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-red-200">
                {result.stderr}
                {result.stderrTruncated ? '\n...(truncated)' : ''}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
