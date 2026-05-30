'use client'

import { useState } from 'react'

interface Props {
  /** 既定の対象アプリ（Epic 由来など） */
  defaultTargetApp?: string
  /** 紐付ける Epic（省略可） */
  epicId?: string
}

/**
 * Codex モバイルでの作業報告を Progress の ExecutionRun へ戻すフォーム。
 * executorUsed=codex / source=codex_mobile を記録する。
 */
export default function CodexReportForm({ defaultTargetApp, epicId }: Props) {
  const [targetApp, setTargetApp] = useState(defaultTargetApp ?? '')
  const [title, setTitle] = useState('')
  const [report, setReport] = useState('')
  const [runStatus, setRunStatus] = useState<'completed' | 'partial' | 'failed'>('completed')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [runId, setRunId] = useState<string | null>(null)

  async function submit() {
    if (!targetApp.trim() || !title.trim() || !report.trim()) {
      setState('error')
      setTimeout(() => setState('idle'), 2000)
      return
    }
    setState('saving')
    try {
      const res = await fetch('/api/execution-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetApp: targetApp.trim(),
          epicId,
          targetTodoTitle: title.trim(),
          runStatus,
          executorUsed: 'codex',
          source: 'codex_mobile',
          summary: title.trim(),
          rawReport: report.trim(),
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error('failed')
      setRunId(json.runId)
      setState('saved')
      setReport('')
      setTitle('')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'

  return (
    <div className="space-y-2">
      <input className={input} placeholder="対象アプリ（例: progress）" value={targetApp} onChange={(e) => setTargetApp(e.target.value)} />
      <input className={input} placeholder="作業タイトル" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className={`${input} h-28`} placeholder="Codex の作業報告をそのまま貼り付け（変更ファイル / 検証結果 / 次アクション 等）" value={report} onChange={(e) => setReport(e.target.value)} />
      <div className="flex gap-2">
        {(['completed', 'partial', 'failed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setRunStatus(s)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs ${runStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}
          >
            {s}
          </button>
        ))}
      </div>
      <button
        onClick={submit}
        disabled={state === 'saving'}
        className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${state === 'saved' ? 'bg-green-600' : state === 'error' ? 'bg-red-600' : 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900'}`}
      >
        {state === 'saving' ? '登録中…' : state === 'saved' ? `✓ 登録しました（${runId}）` : state === 'error' ? '入力不足または失敗' : 'ExecutionRunへ登録（executorUsed=codex）'}
      </button>
    </div>
  )
}
