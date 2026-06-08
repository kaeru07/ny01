'use client'

import { useState } from 'react'
import type { FactoryRunReport, FactoryRunMode } from '@/lib/executors/types'

// 開発者モード用の Factory runner コントロール。既定は dry_run（実起動なし）。
// auto は確認チェックを入れたときだけ confirm=true で実起動する。
export default function FactoryRunnerPanel() {
  const [report, setReport] = useState<FactoryRunReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmAuto, setConfirmAuto] = useState(false)

  async function run(mode: FactoryRunMode) {
    setBusy(true)
    try {
      const res = await fetch('/api/operations/factory-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, maxRuns: 3, maxPerEpic: 3, confirm: mode === 'auto' ? confirmAuto : false }),
      })
      setReport(res.ok ? await res.json() : null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={() => run('dry_run')} disabled={busy} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-blue-700">dry-run 実行</button>
        <button onClick={() => run('manual')} disabled={busy} className="flex-1 rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-600 disabled:opacity-50 hover:bg-blue-50 dark:hover:bg-blue-900/20">manual 実行（記録のみ）</button>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-rose-200 px-3 py-2 dark:border-rose-900/40">
        <label className="flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-300">
          <input type="checkbox" checked={confirmAuto} onChange={(e) => setConfirmAuto(e.target.checked)} className="accent-rose-500" />
          auto 実起動を確認（claude/codex を実際に起動）
        </label>
        <button onClick={() => run('auto')} disabled={busy || !confirmAuto} className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40 hover:bg-rose-700">auto 実行</button>
      </div>
      <p className="text-[10px] text-gray-400">既定は dry_run（実起動なし）。1 起動最大 3 Run / 同一 Epic 最大 3 Run。Factory OFF / Approval / blocked / rate-limit(Codex不可) で停止。</p>

      {report && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            runner: {report.mode} / runs {report.runsExecuted} / 停止: {report.stoppedReason}
          </p>
          <ul className="mt-1.5 space-y-1">
            {report.steps.length === 0 ? (
              <li className="text-[11px] text-gray-400">ステップなし（{report.factoryEnabled ? '候補なし' : 'Factory OFF'}）</li>
            ) : report.steps.map((s, i) => (
              <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300">
                <span className="font-mono text-[10px] text-gray-400">{s.executor}</span> {s.epicTitle}
                {s.result && <> — {s.result.status}{s.result.rateLimited ? ' / rate_limited' : ''}</>}
                {s.recordedRunId && <span className="ml-1 text-gray-400">({s.recordedRunId})</span>}
                {s.stopped && <span className="ml-1 text-rose-600">停止: {s.stopReason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
