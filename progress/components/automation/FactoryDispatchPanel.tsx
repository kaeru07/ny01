'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  FactoryDispatchScan,
  FactoryDispatchPlan,
  DispatchPromptResult,
  ExecutorChoice,
} from '@/lib/types/operations'
import CodexReportForm from '@/components/codex/CodexReportForm'

function PlanDetail({ plan }: { plan: FactoryDispatchPlan }) {
  return (
    <dl className="mt-2 space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
      <div><span className="text-gray-400">goal:</span> {plan.goal}</div>
      <div><span className="text-gray-400">executor候補:</span> <span className="font-semibold">{plan.executorCandidate}</span>（preferred {plan.preferredExecutor ?? '—'} / fallback {plan.fallbackExecutor ?? '—'}）</div>
      <div><span className="text-gray-400">canRunOnCodex:</span> {String(plan.canRunOnCodex)} / requiresClaude: {String(plan.requiresClaude)}</div>
      <div><span className="text-gray-400">承認:</span> {plan.approvalStatus} / 決定: {plan.decisionStatus} / requiresApproval: {String(plan.requiresApproval)}</div>
      <div><span className="text-gray-400">riskFlags:</span> {plan.riskFlags.length > 0 ? plan.riskFlags.join(', ') : 'なし'}</div>
      <div><span className="text-gray-400">doneCriteria:</span> {plan.doneCriteria.length}件 / nextActions: {plan.nextActions.length}件</div>
      <div><span className="text-gray-400">promptType:</span> {plan.promptType}</div>
      {plan.blockedReason && <div className="text-rose-600 dark:text-rose-400">blocked: {plan.blockedReason}</div>}
    </dl>
  )
}

export default function FactoryDispatchPanel() {
  const [scan, setScan] = useState<FactoryDispatchScan | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [result, setResult] = useState<DispatchPromptResult | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle')

  const load = useCallback(async () => {
    const res = await fetch('/api/operations/factory-dispatch', { cache: 'no-store' })
    if (!res.ok) { setScan({ factoryEnabled: false, picked: null, candidates: [], blocked: [] }); return }
    const data: FactoryDispatchScan = await res.json()
    setScan(data)
    setSelectedId((cur) => cur ?? data.picked?.epicId ?? data.candidates[0]?.epicId ?? data.blocked[0]?.epicId ?? null)
  }, [])

  useEffect(() => { load() }, [load])

  const allPlans = scan ? [...scan.candidates, ...scan.blocked] : []
  const selected = allPlans.find((p) => p.epicId === selectedId) ?? scan?.picked ?? null

  async function genPrompt(executor: ExecutorChoice) {
    if (!selected) return
    setState('loading')
    setResult(null)
    try {
      const res = await fetch('/api/operations/factory-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId: selected.epicId, executor }),
      })
      if (!res.ok) throw new Error(String(res.status))
      setResult(await res.json())
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  async function copyPrompt() {
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

  if (!scan) return <p className="text-xs text-gray-400">読み込み中…</p>

  return (
    <div className="space-y-3">
      {!scan.factoryEnabled && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          Factory が OFF のため scan していません。上の「Factory 自動運転」を ON にすると候補が表示されます。
        </p>
      )}
      {/* 候補 Epic 一覧（pick） */}
      <div>
        <p className="mb-1 text-[11px] font-medium text-gray-400">Factory候補Epic（dispatch可 {scan.candidates.length} / 不可 {scan.blocked.length}）</p>
        {allPlans.length === 0 ? (
          <p className="text-xs text-gray-400">Epic がありません。</p>
        ) : (
          <ul className="space-y-1.5">
            {allPlans.map((p) => (
              <li key={p.epicId}>
                <button
                  onClick={() => { setSelectedId(p.epicId); setResult(null) }}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === p.epicId ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <span className="truncate text-gray-800 dark:text-gray-200">
                    {scan.picked?.epicId === p.epicId && <span className="mr-1 rounded bg-blue-600 px-1 text-[10px] text-white">picked</span>}
                    {p.epicTitle}
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.safetyStatus === 'ok' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`}>
                    {p.safetyStatus === 'ok' ? p.executorCandidate : 'blocked'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 選択中の Dispatch Plan */}
      {selected && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Dispatch Plan</p>
          <p className="text-[11px] text-gray-400">{selected.selectedReason}</p>
          <PlanDetail plan={selected} />

          {selected.safetyStatus === 'blocked' ? (
            <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
              dispatch 不可: {selected.blockedReason}
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => genPrompt('claude')}
                disabled={state === 'loading'}
                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
              >
                Claudeへ渡すプロンプト
              </button>
              <button
                onClick={() => genPrompt('codex')}
                disabled={state === 'loading' || !selected.canRunOnCodex}
                title={!selected.canRunOnCodex ? 'この Epic は Codex 対象外' : ''}
                className="flex-1 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                Codexへ渡すプロンプト
              </button>
            </div>
          )}
        </div>
      )}

      {/* 生成プロンプト */}
      {result?.prompt && (
        <div className="rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-green-800 dark:text-green-300">{result.executor} 用プロンプト（{result.promptType}）</p>
            <span className="text-[10px] text-gray-400">{result.plan.dispatchPlanId}</span>
          </div>
          <button
            onClick={copyPrompt}
            className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white ${state === 'copied' ? 'bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {state === 'copied' ? '✓ コピーしました' : `${result.executor} へ渡すプロンプトをコピー`}
          </button>
          <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-2 text-[10px] leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">{result.prompt.promptText}</pre>

          {/* 結果を戻す（dispatchPlanId 付与で dispatch と結合） */}
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-medium text-gray-500">実行結果を戻す（{result.executor}）</p>
            <CodexReportForm
              defaultTargetApp={result.plan.epicId}
              epicId={result.plan.epicId}
              dispatchPlanId={result.plan.dispatchPlanId}
              executor={result.executor === 'codex' ? 'codex' : 'claude'}
            />
          </div>
        </div>
      )}

      {result && !result.prompt && (
        <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          プロンプトを生成できません（{result.executor} 対象外 / blocked）。
        </p>
      )}
    </div>
  )
}
