'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { EpicContractInput, FactoryEligibility } from '@/lib/types/operations'
import { describeFactory } from '@/lib/epic-contract'

interface PreviewResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  normalized?: EpicContractInput
  factoryEligibility?: FactoryEligibility
}

// Epic JSON の取り込み（2 段階: import preview → confirm import）。
// preview は dryRun=true で検証のみ（作成しない）。confirm で実際に作成する。
export default function EpicJsonImport() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [parseError, setParseError] = useState('')
  const [busy, setBusy] = useState(false)

  function parse(): unknown | undefined {
    try {
      return JSON.parse(text)
    } catch {
      setParseError('JSON として解析できません。形式を確認してください。')
      return undefined
    }
  }

  async function doPreview() {
    setParseError('')
    setPreview(null)
    const parsed = parse()
    if (parsed === undefined) return
    setBusy(true)
    try {
      const res = await fetch('/api/operations/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true, epic: parsed }),
      })
      setPreview(await res.json())
    } catch {
      setParseError('プレビューに失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    const parsed = parse()
    if (parsed === undefined) return
    setBusy(true)
    try {
      const res = await fetch('/api/operations/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: parsed }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setPreview({ ok: false, errors: data.errors ?? ['作成に失敗しました'], warnings: data.warnings ?? [] })
        return
      }
      router.push(`/epic/${data.epic.epicId}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setPreview(null) }}
        rows={8}
        placeholder='{ "title": "...", "goal": "...", "doneCriteria": ["..."], "decisionPolicy": "autonomous", "priority": "P1", "riskFlags": [] }'
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
      />
      {parseError && <p className="text-sm text-red-600">{parseError}</p>}

      <button onClick={doPreview} disabled={busy || !text.trim()} className="w-full rounded-xl border border-blue-600 py-2.5 text-sm font-semibold text-blue-600 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20">
        {busy ? '検証中…' : '① プレビュー（検証）'}
      </button>

      {preview && (
        <div className={`rounded-xl border p-3 ${preview.ok ? 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'}`}>
          {preview.ok && preview.normalized ? (
            <>
              <p className="text-sm font-bold text-green-800 dark:text-green-300">検証OK（Draft）</p>
              <dl className="mt-2 space-y-1 text-xs text-gray-700 dark:text-gray-200">
                <div><span className="text-gray-400">title:</span> {preview.normalized.title}</div>
                <div><span className="text-gray-400">goal:</span> {preview.normalized.goal}</div>
                <div><span className="text-gray-400">doneCriteria:</span> {preview.normalized.doneCriteria.length}件</div>
                <div><span className="text-gray-400">decisionPolicy:</span> {preview.normalized.decisionPolicy} / <span className="text-gray-400">priority:</span> {preview.normalized.priority}</div>
                <div><span className="text-gray-400">riskFlags:</span> {preview.normalized.riskFlags.length > 0 ? preview.normalized.riskFlags.join(', ') : 'なし'}</div>
              </dl>
              {preview.factoryEligibility && (() => {
                const fd = describeFactory(preview.factoryEligibility!)
                const text = !fd.managed
                  ? `✗ Factory対象外（${fd.detail}）`
                  : fd.needsApproval
                    ? `✓ Factory対象 / 🛡 要承認（${fd.detail}）`
                    : `✓ Factory対象 / ✅ 自律実行可${fd.cautionLabel ? ` / ${fd.cautionLabel}` : ''}`
                return (
                  <p className={`mt-2 text-xs font-semibold ${!fd.managed ? 'text-gray-500 dark:text-gray-400' : fd.needsApproval ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'}`}>
                    Factory: {text}
                  </p>
                )
              })()}
              {preview.warnings.length > 0 && (
                <ul className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{preview.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
              )}
              <button onClick={confirmImport} disabled={busy} className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-green-700">
                {busy ? '作成中…' : '② この内容で取り込む（confirm）'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">検証エラー</p>
              <ul className="mt-1 space-y-1 text-xs text-rose-700 dark:text-rose-300">{preview.errors.map((er, i) => <li key={i}>・{er}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}
