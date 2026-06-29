'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import MockPhone from '@/components/app-proposals/MockPhone'
import type { AppProposal } from '@/lib/app-proposals'

const decisionBadge = {
  undecided: {
    label: '未判断',
    className: 'border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200',
    article: 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950',
  },
  approved: {
    label: '承認済み',
    className: 'bg-green-600 text-white dark:bg-green-500',
    article: 'border-green-200 bg-green-50/40 dark:border-green-900/60 dark:bg-green-950/20',
  },
  not_needed: {
    label: '作成不要',
    className: 'bg-blue-600 text-white dark:bg-blue-500',
    article: 'border-blue-200 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20',
  },
  rejected: {
    label: '却下',
    className: 'bg-rose-600 text-white dark:bg-rose-500',
    article: 'border-rose-200 bg-rose-50/40 dark:border-rose-900/60 dark:bg-rose-950/20',
  },
  held: {
    label: '保留',
    className: 'bg-amber-500 text-white dark:bg-amber-500',
    article: 'border-amber-200 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20',
  },
} as const

const postDecisions = {
  approve: '承認',
  not_needed: '作成不要',
  reject: '却下',
  hold: '保留',
} as const

type PostDecision = keyof typeof postDecisions

export default function AppProposalCard({ proposal }: { proposal: AppProposal }) {
  const router = useRouter()
  const [screenIndex, setScreenIndex] = useState(0)
  const [pendingDecision, setPendingDecision] = useState<PostDecision | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const screen = proposal.screens[screenIndex] ?? proposal.screens[0]
  const tabs = proposal.screens.map((item) => item.name)
  const status = decisionBadge[proposal.decision ?? 'undecided']

  async function decide(decision: PostDecision) {
    if (busy) return
    if ((decision === 'reject' || decision === 'hold') && pendingDecision !== decision) {
      setPendingDecision(decision)
      setError(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/app-proposals/${encodeURIComponent(proposal.id)}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          note: decision === 'approve' || decision === 'not_needed' ? undefined : note,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? '保存に失敗しました')
      }
      setPendingDecision(null)
      setNote('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`space-y-3 rounded-2xl border p-4 shadow-sm ${status.article}`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{proposal.projectId ?? '未分類'}</p>
            <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{proposal.name}</h2>
          </div>
        </div>
        <div className={`rounded-xl px-3 py-2 text-sm font-black ${status.className}`}>
          <p>{status.label}</p>
          {proposal.decisionNote ? <p className="mt-0.5 text-[11px] font-bold opacity-80">{proposal.decisionNote}</p> : null}
        </div>
        <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">{proposal.purpose}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <InfoTile label="収益化仮説" value={proposal.monetizationHypothesis} />
          <InfoTile label="対象ユーザー" value={proposal.targetUser} />
          <InfoTile label="優先度" value={proposal.priority} />
          <InfoTile label="状態" value={proposal.status} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {proposal.features.map((feature) => (
            <span key={feature} className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              {feature}
            </span>
          ))}
        </div>
        <div className="rounded-xl bg-gray-50 p-2 text-[11px] leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300">
          <p><span className="font-bold">次のアクション:</span> {proposal.nextAction}</p>
          <p><span className="font-bold">工場判定:</span> {proposal.factorySafe ? '安全' : '要確認'}{proposal.factoryNote ? ` / ${proposal.factoryNote}` : ''}</p>
          {proposal.decisionNote ? <p><span className="font-bold">判断メモ:</span> {proposal.decisionNote}</p> : null}
        </div>
      </div>

      <div className="space-y-2">
        <MockPhone appName={proposal.name} screen={screen} tabs={tabs} />
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="min-h-10 rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            onClick={() => setScreenIndex((current) => Math.max(0, current - 1))}
            disabled={screenIndex === 0}
          >
            ◀
          </button>
          <span className="min-w-24 text-center text-xs font-black text-gray-700 dark:text-gray-200">
            画面 {screenIndex + 1}/{proposal.screens.length}
          </span>
          <button
            type="button"
            className="min-h-10 rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
            onClick={() => setScreenIndex((current) => Math.min(proposal.screens.length - 1, current + 1))}
            disabled={screenIndex >= proposal.screens.length - 1}
          >
            ▶
          </button>
        </div>
      </div>

      {pendingDecision ? (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
          <label className="block text-xs font-bold text-amber-900 dark:text-amber-100" htmlFor={`note-${proposal.id}`}>
            {postDecisions[pendingDecision]}メモ（任意）
          </label>
          <textarea
            id={`note-${proposal.id}`}
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-800 dark:bg-gray-950 dark:text-gray-100"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="理由や補足があれば入力"
          />
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <DecisionButton disabled={busy} label="承認" tone="green" onClick={() => decide('approve')} />
        <DecisionButton disabled={busy} label="作成不要" tone="blue" onClick={() => decide('not_needed')} />
        <DecisionButton disabled={busy} label={pendingDecision === 'reject' ? '却下を保存' : '却下'} tone="rose" onClick={() => decide('reject')} />
        <DecisionButton disabled={busy} label={pendingDecision === 'hold' ? '保留を保存' : '保留'} tone="gray" onClick={() => decide('hold')} />
      </div>
    </article>
  )
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-900">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 line-clamp-3 text-[11px] font-bold leading-snug text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  )
}

function DecisionButton({ disabled, label, tone, onClick }: { disabled: boolean; label: string; tone: 'green' | 'blue' | 'rose' | 'gray'; onClick: () => void }) {
  const toneClass = {
    green: 'bg-green-600 text-white dark:bg-green-500',
    blue: 'bg-blue-600 text-white dark:bg-blue-500',
    rose: 'bg-rose-600 text-white dark:bg-rose-500',
    gray: 'bg-gray-800 text-white dark:bg-gray-700',
  }[tone]

  return (
    <button
      type="button"
      className={`min-h-11 rounded-xl px-2 text-xs font-black disabled:opacity-50 ${toneClass}`}
      disabled={disabled}
      onClick={onClick}
    >
      {disabled ? '保存中' : label}
    </button>
  )
}
