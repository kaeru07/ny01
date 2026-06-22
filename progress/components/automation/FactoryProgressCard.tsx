'use client'

import { useCallback, useEffect, useState } from 'react'
import type { FactoryStatusSummary, FactoryState } from '@/lib/factory-status'

const STATE_VIEW: Record<FactoryState, { emoji: string; cls: string }> = {
  実行中: { emoji: '🟢', cls: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' },
  承認待ち: { emoji: '🟡', cls: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' },
  停止中: { emoji: '⚪', cls: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40' },
  再開待ち: { emoji: '🟠', cls: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20' },
  Codex準備完了: { emoji: '🟣', cls: 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20' },
  アイドル: { emoji: '🔵', cls: 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10' },
}

function fmt(dt?: string): string {
  if (!dt) return '—'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const CLAUDE_LABEL: Record<string, string> = { none: '正常', detected: '上限検知', ambiguous: '要確認' }

export default function FactoryProgressCard() {
  const [s, setS] = useState<FactoryStatusSummary | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/operations/factory-status', { cache: 'no-store' })
    setS(res.ok ? await res.json() : null)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleFactory(on: boolean) {
    setBusy(true)
    try {
      await fetch('/api/operations/automation-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryEnabled: on }),
      })
      await load()
    } finally {
      setBusy(false)
    }
  }

  if (!s) return <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-400 dark:border-gray-800">読み込み中…</div>

  const view = STATE_VIEW[s.state]
  return (
    <section className={`rounded-2xl border p-4 ${view.cls}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden>{view.emoji}</span>
          <div>
            <p className="text-[11px] font-medium text-gray-400">Factory 進行状況</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{s.state}</p>
          </div>
        </div>
        <button onClick={load} className="text-[11px] text-blue-600 underline">更新</button>
      </div>

      {/* Factory ON/OFF スイッチ */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-white/60 px-3 py-2 dark:bg-gray-900/40">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Factory 自動運転</p>
          <p className="text-[10px] text-gray-400">OFF のとき一切 scan しません。ON のときのみ scan→pick へ進みます。</p>
        </div>
        <button
          onClick={() => toggleFactory(!s.factoryEnabled)}
          disabled={busy}
          aria-pressed={s.factoryEnabled}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${s.factoryEnabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${s.factoryEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {s.currentEpic && (
        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">
          対象Epic: <span className="font-medium">{s.currentEpic}</span>
        </p>
      )}
      {s.stopReason && (
        <p className="mt-1 rounded-lg bg-white/60 px-2.5 py-1.5 text-[11px] text-gray-600 dark:bg-gray-900/40 dark:text-gray-300">停止/待機理由: {s.stopReason}</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="実行待ち" value={s.runnable} />
        <Stat label="承認待ち" value={s.pendingApproval} warn={s.pendingApproval > 0} />
        <Stat label="停止" value={s.stopped} />
      </div>

      <dl className="mt-3 space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
        <Row k="Claude利用状況" v={`${CLAUDE_LABEL[s.claudeStatus] ?? s.claudeStatus}`} />
        <Row k="実行Executor(参考)" v={`${s.executor}（mode: ${s.executorMode}）`} />
        <Row k="最終実行" v={fmt(s.lastRunAt)} />
        <Row k="最終Fallback" v={`${fmt(s.lastFallbackAt)}${s.fallbackReason ? ` / ${s.fallbackReason}` : ''}${s.fallbackStatus ? ` / ${s.fallbackStatus}` : ''}`} />
        <Row k="次回実行予定" v={s.nextPlanned ?? '—'} />
      </dl>
      {s.pickedDoneCriteria && s.pickedDoneCriteria.hasContract && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white/60 p-3 dark:border-gray-700 dark:bg-gray-900/40">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100">doneCriteria 判定</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.pickedDoneCriteria.verdict === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
              {s.pickedDoneCriteria.verdict === 'done' ? 'DONE' : 'CONTINUE'} · {s.pickedDoneCriteria.ratio}
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {s.pickedDoneCriteria.criteria.map((c, i) => (
              <li key={i} className="text-[11px] text-gray-700 dark:text-gray-300">
                <span className={c.met ? 'text-green-600' : 'text-rose-500'}>{c.met ? '✓' : '✗'}</span> {c.text}
                <span className="ml-1 text-[10px] text-gray-400">[{c.level}] {c.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[10px] text-gray-400">Executor は内部状態です。ユーザーは「Factory が進行しているか」を確認すれば十分です。</p>
    </section>
  )
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg py-2 ${warn ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-white/60 dark:bg-gray-900/40'}`}>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-gray-400">{k}</dt>
      <dd className="text-right text-gray-700 dark:text-gray-200">{v}</dd>
    </div>
  )
}
