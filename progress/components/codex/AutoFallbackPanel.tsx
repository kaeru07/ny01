'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AutoFallbackResult, AutomationLogEntry, FallbackBlockKind } from '@/lib/types/operations'

interface Props {
  /** 省略時は全体で評価 */
  epicId?: string
}

const BLOCK_LABEL: Record<FallbackBlockKind, string> = {
  disabled: '設定OFF',
  approval_required: 'approval_required',
  decision_required: 'decision_required',
  requires_approval: 'requires_approval',
  requires_claude: 'requires_claude',
  destructive: 'blocked（危険作業）',
  no_codex_candidate: 'blocked（候補なし）',
}

export default function AutoFallbackPanel({ epicId }: Props) {
  const [result, setResult] = useState<AutoFallbackResult | null>(null)
  const [log, setLog] = useState<AutomationLogEntry[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  const loadLog = useCallback(async () => {
    const res = await fetch('/api/operations/automation-log?limit=5', { cache: 'no-store' })
    setLog(res.ok ? await res.json() : [])
  }, [])

  useEffect(() => {
    loadLog()
  }, [loadLog])

  async function trigger() {
    setState('loading')
    try {
      const res = await fetch('/api/operations/auto-fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId, reason: 'claude_rate_limited' }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setResult(await res.json())
      setState('idle')
      loadLog()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  async function copy() {
    if (!result?.prompt) return
    try {
      await navigator.clipboard.writeText(result.prompt.promptText)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <div>
      <button
        onClick={trigger}
        disabled={state === 'loading'}
        className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
      >
        {state === 'loading' ? '判定中…' : '⚠ Claude上限として扱う（Codex引き継ぎを評価）'}
      </button>

      {result && result.status === 'codex_ready' && (
        <div className="mt-3 rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-bold text-green-800 dark:text-green-300">Claude上限を検知しました</p>
          <p className="text-xs text-green-700 dark:text-green-400">Codex引き継ぎ候補があります</p>
          <div className="mt-2 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
            <p>対象: {result.epicTitle ?? '全体（現在のコンテキスト）'}</p>
            <p>安全判定: <span className="font-semibold text-green-700">OK</span>（{result.safetyGuard ? '安全判定ガード付き' : '—'}）</p>
            {result.codexPromptSourceRunId && <p>元Run: {result.codexPromptSourceRunId}</p>}
          </div>
          <button
            onClick={copy}
            className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${state === 'copied' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {state === 'copied' ? '✓ コピーしました（Codexへ貼り付け）' : 'Codex用プロンプトをコピー'}
          </button>
          {result.prompt && (
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">
{result.prompt.promptText}
            </pre>
          )}
        </div>
      )}

      {result && result.status === 'blocked' && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">Codexへは渡せません</p>
          <p className="text-xs text-rose-700 dark:text-rose-400">安全判定でブロックされました（Codexプロンプトは生成していません）</p>
          <ul className="mt-2 space-y-1">
            {result.blocked.map((b, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300">
                <span className="mr-1 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{BLOCK_LABEL[b.kind]}</span>
                {b.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-gray-400">Automation Log（直近）</p>
          <ul className="space-y-1">
            {log.map((e) => (
              <li key={e.id} className="text-[11px] text-gray-500">
                {new Date(e.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                {e.fallbackReason} · {e.codexPromptGenerated ? 'codex_ready' : `blocked(${e.blockedReason ?? '-'})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
