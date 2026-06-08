'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AutoResumeResult, AutoResumeState } from '@/lib/types/operations'

const STATE_VIEW: Record<AutoResumeState, { emoji: string; label: string; cls: string }> = {
  running: { emoji: '🟢', label: '再開可能', cls: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' },
  auto_resumed: { emoji: '🔵', label: '自動再開済み', cls: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' },
  paused: { emoji: '⚪', label: '一時停止（OFF）', cls: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40' },
  blocked: { emoji: '🔴', label: '再開ブロック', cls: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20' },
}

function fmt(dt?: string): string {
  if (!dt) return '—'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AutoResumePanel() {
  const [result, setResult] = useState<AutoResumeResult | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  const evaluate = useCallback(async () => {
    try {
      const res = await fetch('/api/operations/auto-resume', { cache: 'no-store' })
      setResult(res.ok ? await res.json() : null)
    } catch {
      setResult(null)
    }
  }, [])

  useEffect(() => {
    evaluate()
  }, [evaluate])

  async function trigger() {
    setState('loading')
    try {
      const res = await fetch('/api/operations/auto-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error(String(res.status))
      setResult(await res.json())
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  async function copyContext() {
    if (!result?.resumeContext) return
    try {
      await navigator.clipboard.writeText(result.resumeContext.promptText)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const view = result ? STATE_VIEW[result.state] : STATE_VIEW.paused

  return (
    <div className={`rounded-xl border p-3 ${view.cls}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none" aria-hidden>{view.emoji}</span>
          <div>
            <p className="text-[11px] font-medium text-gray-400">Auto Resume 状態</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{view.label}</p>
          </div>
        </div>
        <button onClick={evaluate} className="text-[11px] text-blue-600 underline">再評価</button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-white/60 py-1.5 dark:bg-gray-900/40">
          <div className="text-base font-bold text-gray-900 dark:text-gray-100">{result?.resumableCount ?? '–'}</div>
          <div className="text-[10px] text-gray-500">再開対象件数</div>
        </div>
        <div className="rounded-lg bg-white/60 py-1.5 dark:bg-gray-900/40">
          <div className="text-xs font-bold text-gray-900 dark:text-gray-100">{fmt(result?.lastResumedAt)}</div>
          <div className="text-[10px] text-gray-500">最終再開時刻</div>
        </div>
      </div>

      {result?.resumeExecutor && (
        <p className="mt-2 text-[11px] text-gray-500">再開実行者: <span className="font-semibold">{result.resumeExecutor}</span>（Claude 上限中の継続担当）</p>
      )}

      {result && result.state === 'blocked' && (
        <div className="mt-2 space-y-1">
          {result.executorNote && <p className="text-[11px] text-rose-700 dark:text-rose-300">{result.executorNote}</p>}
          {result.blockedReasons.map((b, i) => (
            <p key={i} className="text-[11px] text-gray-600 dark:text-gray-300">
              <span className="mr-1 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{b.kind}</span>
              {b.reason}
            </p>
          ))}
        </div>
      )}

      {result && result.state === 'paused' && (
        <p className="mt-2 text-[11px] text-gray-500">上の「Auto Resume」トグルを ON にすると、Claude 上限後に安全な作業だけ自動継続します。</p>
      )}

      {result?.canResume && (
        <div className="mt-3">
          <button
            onClick={trigger}
            disabled={state === 'loading'}
            className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {state === 'loading' ? '再開処理中…' : '▶ 安全作業を再開する'}
          </button>
          {result.resumeContext && (
            <button
              onClick={copyContext}
              className={`mt-2 w-full rounded-lg px-4 py-2 text-sm font-semibold ${state === 'copied' ? 'bg-blue-700 text-white' : 'border border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
            >
              {state === 'copied' ? '✓ コピーしました' : `再開プロンプトをコピー（${result.resumeExecutor} 向け）`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
