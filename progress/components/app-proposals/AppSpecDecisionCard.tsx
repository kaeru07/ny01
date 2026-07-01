'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppProposal } from '@/lib/app-proposals'

type SpecAction = 'approve' | 'hold'

const actionLabel: Record<SpecAction, string> = {
  approve: '仕様を承認',
  hold: '保留',
}

export default function AppSpecDecisionCard({
  app,
  latestDecision,
}: {
  app: AppProposal
  latestDecision?: { action?: string; decision: string; note?: string }
}) {
  const router = useRouter()
  const [pending, setPending] = useState<SpecAction | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(action: SpecAction) {
    if (busy) return
    if (action === 'hold' && pending !== action) {
      setPending(action)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/app-specs/${encodeURIComponent(app.id)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: action,
          note: action === 'hold' ? note : undefined,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? '保存に失敗しました')
      setPending(null)
      setNote('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{app.projectId ?? app.id}</p>
          <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{app.name}</h2>
          <p className="mt-1 text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">{app.overview}</p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          {app.status}
        </span>
      </div>

      {latestDecision ? (
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          最新判断: {latestDecision.decision}
          {latestDecision.note ? <span className="ml-1 font-semibold opacity-80">/ {latestDecision.note}</span> : null}
        </div>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">画面仕様</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {app.screens.map((screen) => (
            <div key={screen.key} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
              <p className="text-xs font-black text-gray-900 dark:text-gray-100">{screen.name}</p>
              <ul className="mt-2 space-y-1">
                {screen.rows.map((row) => (
                  <li key={row} className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                    {row}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">機能</h3>
        <div className="flex flex-wrap gap-1.5">
          {app.features.map((feature) => (
            <span key={feature} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              {feature}
            </span>
          ))}
        </div>
      </section>

      <div className="rounded-xl bg-gray-50 p-2.5 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300">
        <p><span className="font-bold">現在の状態:</span> {app.status} / {app.priority}</p>
        <p><span className="font-bold">次のアクション:</span> {app.nextAction}</p>
      </div>

      {pending === 'hold' ? (
        <textarea
          className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-800 dark:bg-gray-950 dark:text-gray-100"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="保留理由や確認したい点"
        />
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          className="min-h-10 rounded-lg bg-green-600 px-3 text-xs font-black text-white disabled:opacity-50 dark:bg-green-500"
          onClick={() => decide('approve')}
        >
          {actionLabel.approve}
        </button>
        <button
          type="button"
          disabled={busy}
          className="min-h-10 rounded-lg bg-gray-800 px-3 text-xs font-black text-white disabled:opacity-50 dark:bg-gray-700"
          onClick={() => decide('hold')}
        >
          {pending === 'hold' ? '保留を保存' : actionLabel.hold}
        </button>
      </div>
    </article>
  )
}
