'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Epic, Approval, HealthSummary } from '@/lib/types/operations'

interface AutoexecStatus {
  name: string | null
  status: string
  cpu?: number | null
  memory?: number | null
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return res.json() as Promise<T>
}

export default function OperationsPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [autoexec, setAutoexec] = useState<AutoexecStatus | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [epics, setEpics] = useState<Epic[]>([])
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [h, a, ap, ep] = await Promise.all([
      getJson<HealthSummary>('/api/operations/health').catch(() => null),
      getJson<AutoexecStatus>('/api/operations/autoexec').catch(() => null),
      getJson<Approval[]>('/api/operations/approvals').catch(() => []),
      getJson<Epic[]>('/api/operations/epics').catch(() => []),
    ])
    setHealth(h)
    setAutoexec(a)
    setApprovals(ap)
    setEpics(ep.filter((e) => e.status === 'active'))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function controlAutoexec(action: 'start' | 'stop' | 'restart') {
    setBusy(true)
    try {
      await fetch('/api/operations/autoexec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function decide(approvalId: string, decidedOption: string) {
    setBusy(true)
    try {
      await fetch('/api/operations/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, decidedOption }),
      })
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-4 space-y-6">
      <h1 className="text-lg font-bold">工場オペレーション</h1>

      {/* ① ヘルスバー */}
      <section>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <HealthChip label="実行可" value={health?.runnable} />
          <HealthChip label="実行中" value={health?.running} />
          <HealthChip label="承認待ち" value={health?.pendingApproval} />
          <HealthChip label="上限待ち" value={health?.limitWaiting} />
          <HealthChip label="停止" value={health?.stopped} />
          <HealthChip label="Epic" value={health?.epicsActive} />
          <HealthChip
            label="放置"
            value={health?.stale}
            warn={(health?.stale ?? 0) > 0}
          />
        </div>
      </section>

      {/* ② 自動実行コントロール */}
      <section className="rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">自動実行 (vloop)</span>
          <span className="text-xs text-gray-600">
            {autoexec?.name ?? '—'}:{' '}
            <span
              className={
                autoexec?.status === 'online'
                  ? 'text-green-600 font-medium'
                  : 'text-gray-500'
              }
            >
              {autoexec?.status ?? '不明'}
            </span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy}
            onClick={() => controlAutoexec('start')}
            className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            開始
          </button>
          <button
            disabled={busy}
            onClick={() => controlAutoexec('stop')}
            className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            停止
          </button>
          <button
            disabled={busy}
            onClick={() => controlAutoexec('restart')}
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            再開
          </button>
        </div>
      </section>

      {/* ③ 承認待ち（0件なら非表示） */}
      {approvals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold">承認待ち ({approvals.length})</h2>
          {approvals.map((a) => (
            <ApprovalCard key={a.approvalId} approval={a} busy={busy} onDecide={decide} />
          ))}
        </section>
      )}

      {/* ④ Epic進行 */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold">Epic進行 ({epics.length})</h2>
        {epics.length === 0 && (
          <p className="text-sm text-gray-500">アクティブな Epic はありません</p>
        )}
        {epics.map((e) => (
          <EpicCard key={e.epicId} epic={e} />
        ))}
      </section>
    </div>
  )
}

function HealthChip({
  label,
  value,
  warn,
}: {
  label: string
  value?: number
  warn?: boolean
}) {
  return (
    <div
      className={`flex shrink-0 flex-col items-center rounded-lg border px-3 py-2 ${
        warn ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <span className="text-lg font-bold leading-none">
        {value ?? '–'}
        {warn ? ' ⚠' : ''}
      </span>
      <span className="mt-1 whitespace-nowrap text-[11px] text-gray-600">{label}</span>
    </div>
  )
}

const PRIORITY_BADGE: Record<Approval['priority'], string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
}

function ApprovalCard({
  approval,
  busy,
  onDecide,
}: {
  approval: Approval
  busy: boolean
  onDecide: (approvalId: string, option: string) => void
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium">{approval.title}</span>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${PRIORITY_BADGE[approval.priority]}`}
        >
          {approval.priority}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{approval.reason}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {approval.options.map((opt) => {
          const recommended = opt.key === approval.recommended
          return (
            <button
              key={opt.key}
              disabled={busy}
              onClick={() => onDecide(approval.approvalId, opt.key)}
              className={`rounded px-3 py-2 text-sm disabled:opacity-50 ${
                recommended
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
        <button
          disabled={busy}
          onClick={() => onDecide(approval.approvalId, '__hold__')}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-600 disabled:opacity-50"
        >
          保留
        </button>
      </div>
    </div>
  )
}

function EpicCard({ epic }: { epic: Epic }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{epic.title}</span>
        <span className="text-xs text-gray-500">{epic.progress}%</span>
      </div>
      <p className="mt-1 text-xs text-gray-600">{epic.goal}</p>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${Math.min(100, Math.max(0, epic.progress))}%` }}
        />
      </div>
      <p className="mt-2 text-xs">
        <span className="text-gray-500">次: </span>
        {epic.nextAction}
      </p>
      {epic.latestRunId && (
        <p className="mt-1 text-[11px] text-gray-400">runId: {epic.latestRunId}</p>
      )}
    </div>
  )
}
