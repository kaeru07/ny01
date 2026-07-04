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

const riskFlagLabels = {
  billing: '課金',
  production_db: '本番DB',
  auth_secret: '認証情報',
  external_publish: '外部公開',
  destructive: '破壊的操作',
  migration: 'スキーマ変更',
  deploy: 'デプロイ',
} as const

const pipelineStatusBadge = {
  queued: {
    label: 'キュー投入済み',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  },
  held: {
    label: '必須判断待ち',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  },
  in_progress: {
    label: '作成中',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
  blocked: {
    label: '停止中',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
  },
  completed: {
    label: '完成',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  },
} as const

const difficultyBadge = {
  low: { label: '低', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' },
  medium: { label: '中', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  high: { label: '高', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' },
} as const

type PostDecision = keyof typeof postDecisions

export default function AppProposalCard({ proposal }: { proposal: AppProposal }) {
  const router = useRouter()
  const [detailOpen, setDetailOpen] = useState(false)
  const [pendingDecision, setPendingDecision] = useState<PostDecision | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [approvedInfo, setApprovedInfo] = useState<{ approvalCount: number; requiredCount: number } | null>(null)
  const status = decisionBadge[proposal.decision ?? 'undecided']
  const riskFlags = proposal.riskFlags ?? []
  const oceanBadge = proposal.oceanType === 'blue'
    ? { label: 'ブルー', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200' }
    : proposal.oceanType === 'red'
      ? { label: 'レッド', className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
      : null
  // 承認/却下/作成不要は「決定済み」。決定ボタン(作る/見送り/保留)は出さない（保留・未判断のみ操作可）。
  const isFinalized = proposal.decision === 'approved' || proposal.decision === 'rejected' || proposal.decision === 'not_needed'
  const pipelineBadge = proposal.decision === 'approved' && proposal.pipelineStatus
    ? pipelineStatusBadge[proposal.pipelineStatus]
    : null

  async function decide(decision: PostDecision) {
    if (busy) return
    if ((decision === 'approve' || decision === 'reject' || decision === 'hold') && pendingDecision !== decision) {
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
          note: decision === 'not_needed' ? undefined : note,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(body?.error ?? '保存に失敗しました')
      }
      setPendingDecision(null)
      setNote('')
      if (decision === 'approve') {
        setApprovedInfo({
          approvalCount: typeof body?.approvalCount === 'number' ? body.approvalCount : 0,
          requiredCount: typeof body?.requiredCount === 'number' ? body.requiredCount : 0,
        })
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`space-y-3 rounded-2xl border p-4 shadow-sm ${status.article}`}>
      {/* 一覧行: アプリ名・概要・状態/優先度/オーシャンのバッジだけ。モックや詳細は「詳細」ポップアップで見る。 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{proposal.projectId ?? '未分類'}</p>
          <h2 className="truncate text-base font-black text-gray-900 dark:text-gray-100">{proposal.name}</h2>
          <p className="mt-0.5 line-clamp-2 text-xs font-semibold leading-relaxed text-gray-600 dark:text-gray-300">{proposal.overview}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${status.className}`}>{status.label}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">優先度 {proposal.priority}</span>
          {oceanBadge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${oceanBadge.className}`}>{oceanBadge.label}</span> : null}
          {pipelineBadge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${pipelineBadge.className}`}>{pipelineBadge.label}</span> : null}
          {riskFlags.length > 0 ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-200">⚠危険要素あり</span>
          ) : null}
        </div>
      </div>
      {proposal.decisionNote ? <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">メモ: {proposal.decisionNote}</p> : null}

      <button
        type="button"
        className="min-h-11 w-full rounded-xl border border-gray-300 px-3 text-sm font-black text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-900"
        onClick={() => setDetailOpen(true)}
      >
        詳細（モック・収益イメージ・仕様）を見る
      </button>

      {pendingDecision ? (
        <div className="space-y-2 rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
          <label className="block text-xs font-bold text-amber-900 dark:text-amber-100" htmlFor={`note-${proposal.id}`}>
            {pendingDecision === 'approve' ? '意図・要望メモ（任意）' : `${postDecisions[pendingDecision]}メモ（任意）`}
          </label>
          <textarea
            id={`note-${proposal.id}`}
            className="min-h-20 w-full rounded-lg border border-amber-200 bg-white p-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-800 dark:bg-gray-950 dark:text-gray-100"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={pendingDecision === 'approve' ? '例: シンプル操作重視 / 広告なし / 通勤中に片手で使う 等' : '理由や補足があれば入力'}
          />
        </div>
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-900/20 dark:text-red-200">{error}</p> : null}

      {isFinalized ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {proposal.decision === 'approved' ? '✅ 作成決定済み（自動実行で開発中）' : proposal.decision === 'rejected' ? '却下済み' : '作成不要と判断済み'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <DecisionButton disabled={busy} label={pendingDecision === 'approve' ? '作成を決定' : 'このアプリを作る'} tone="green" onClick={() => decide('approve')} />
          <DecisionButton disabled={busy} label={pendingDecision === 'reject' ? '見送りを保存' : '見送り'} tone="rose" onClick={() => decide('reject')} />
          <DecisionButton disabled={busy} label={pendingDecision === 'hold' ? '保留を保存' : '保留'} tone="gray" onClick={() => decide('hold')} />
        </div>
      )}
      {approvedInfo ? (
        <div className="space-y-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-xs font-black text-green-800 dark:text-green-200">
            作成を決定しました。ゴールを自動実行キューに追加{approvedInfo.approvalCount > 0 ? `し、方針${approvedInfo.approvalCount}件を今日の判断に追加` : ''}しました。
            {approvedInfo.requiredCount > 0 ? ` 必須判断${approvedInfo.requiredCount}件の回答まで自動作成は保留されます。` : ''}
          </p>
          <button
            type="button"
            className="min-h-10 w-full rounded-full bg-green-600 px-3 text-xs font-black text-white hover:bg-green-700"
            onClick={() => router.push('/decide?tab=today')}
          >
            今日の判断へ →
          </button>
        </div>
      ) : null}
      {detailOpen ? <AppProposalDetailModal proposal={proposal} onClose={() => setDetailOpen(false)} /> : null}
    </article>
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

function AppProposalDetailModal({ proposal, onClose }: { proposal: AppProposal; onClose: () => void }) {
  const [tab, setTab] = useState<'spec' | 'market' | 'money' | 'plan'>('spec')
  const tabs = [
    { key: 'spec' as const, label: '画面・仕様' },
    { key: 'market' as const, label: '市場・オーシャン' },
    { key: 'money' as const, label: '収益化' },
    { key: 'plan' as const, label: '実装計画' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 p-0 sm:items-center sm:justify-center sm:p-3" role="dialog" aria-modal="true">
      <div className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-950 sm:max-h-[88dvh] sm:max-w-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{proposal.projectId ?? '未分類'}</p>
            <h3 className="mt-0.5 text-lg font-black text-gray-900 dark:text-gray-100">{proposal.name}</h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{proposal.overview}</p>
          </div>
          <button
            type="button"
            className="min-h-9 shrink-0 rounded-lg border border-gray-200 px-3 text-xs font-black text-gray-700 dark:border-gray-700 dark:text-gray-200"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-black sm:flex-1 ${
                tab === item.key
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {/* flex-1 + min-h-0 で残り領域を必ずスクロール可能に。pb-10 で最下部まで到達できるようにする。 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-10">
          {tab === 'spec' ? <SpecTab proposal={proposal} /> : null}
          {tab === 'market' ? <MarketTab proposal={proposal} /> : null}
          {tab === 'money' ? <MoneyTab proposal={proposal} /> : null}
          {tab === 'plan' ? <PlanTab proposal={proposal} /> : null}
        </div>
      </div>
    </div>
  )
}

function SpecTab({ proposal }: { proposal: AppProposal }) {
  const [screenIndex, setScreenIndex] = useState(0)
  const screen = proposal.screens[screenIndex] ?? proposal.screens[0]
  const tabs = proposal.screens.map((item) => item.name)
  return (
    <div className="space-y-4">
      {proposal.screens.length > 0 && screen ? (
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
      ) : null}
      <InfoBlock label="対象ユーザー" value={proposal.targetUser} />
      <InfoBlock label="詳細仕様" value={proposal.spec || '未記入'} />
      <RiskFlagsBlock proposal={proposal} />
      <div>
        <p className="text-xs font-black text-gray-500 dark:text-gray-400">主要機能</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {proposal.features.map((feature) => (
            <span key={feature} className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
              {feature}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-black text-gray-500 dark:text-gray-400">画面</p>
        {proposal.screens.map((screen) => (
          <div key={screen.key} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
            <p className="text-sm font-black text-gray-900 dark:text-gray-100">{screen.name}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-700 dark:text-gray-300">
              {screen.rows.map((row) => <li key={row}>{row}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function MarketTab({ proposal }: { proposal: AppProposal }) {
  const tone = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
    red: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
    unknown: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  }[proposal.oceanType]
  const label = { blue: 'ブルー', red: 'レッド', unknown: '未判定' }[proposal.oceanType]
  return (
    <div className="space-y-4">
      <InfoBlock label="市場価値" value={proposal.marketValue || '未設定'} />
      <RiskFlagsBlock proposal={proposal} />
      <div>
        <p className="text-xs font-black text-gray-500 dark:text-gray-400">オーシャン判定</p>
        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${tone}`}>{label}</span>
      </div>
      <InfoBlock label="判断根拠" value={proposal.oceanRationale || '未設定'} />
      <ListBlock label="勝機" items={proposal.winningFactors ?? []} tone="green" />
      <ListBlock label="懸念" items={proposal.concerns ?? []} tone="amber" />
    </div>
  )
}

function RiskFlagsBlock({ proposal }: { proposal: AppProposal }) {
  const flags = proposal.riskFlags ?? []
  if (flags.length === 0) return null
  return (
    <div>
      <p className="text-xs font-black text-gray-500 dark:text-gray-400">危険要素</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {flags.map((flag) => (
          <span key={flag} className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-black text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            {riskFlagLabels[flag] ?? flag}
          </span>
        ))}
      </div>
    </div>
  )
}

function MoneyTab({ proposal }: { proposal: AppProposal }) {
  return (
    <div className="space-y-4">
      <RevenueImage />
      <InfoBlock label="収益化計画" value={proposal.monetizationPlan || '未設定'} />
      <InfoBlock label="収益化仮説" value={proposal.monetizationHypothesis} />
    </div>
  )
}

function PlanTab({ proposal }: { proposal: AppProposal }) {
  const apis = (proposal.externalApis ?? []).filter((api) => api.trim())
  const difficulty = proposal.difficulty ? difficultyBadge[proposal.difficulty] : null
  const hasContent = Boolean(proposal.mvpScope || difficulty || apis.length > 0 || proposal.initialGoalDraft)

  if (!hasContent) {
    return <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">未設定</p>
  }

  return (
    <div className="space-y-4">
      {proposal.mvpScope ? <InfoBlock label="MVP範囲" value={proposal.mvpScope} /> : null}
      {difficulty ? (
        <div>
          <p className="text-xs font-black text-gray-500 dark:text-gray-400">開発難易度</p>
          <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${difficulty.className}`}>{difficulty.label}</span>
        </div>
      ) : null}
      {apis.length > 0 ? (
        <div>
          <p className="text-xs font-black text-gray-500 dark:text-gray-400">必要な外部サービス・API</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {apis.map((api) => (
              <span key={api} className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {api}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {proposal.initialGoalDraft ? <InfoBlock label="Codexへの初期Goal案" value={proposal.initialGoalDraft} /> : null}
    </div>
  )
}

// 収益イメージ（ストア公開アプリの収益ファネルの目安型）。実数値ではなく到達イメージを可視化する。
function RevenueImage() {
  const stages = [
    { label: 'ストアDL', pct: 100, note: '無料DL・流入' },
    { label: '継続利用', pct: 55, note: 'リテンション' },
    { label: '課金転換', pct: 18, note: '有料・アプリ内課金' },
    { label: '月次収益', pct: 10, note: '積み上げ' },
  ]
  return (
    <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <p className="text-xs font-black text-gray-500 dark:text-gray-400">収益イメージ（ファネルの目安）</p>
      <div className="mt-3 space-y-2">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="flex justify-between text-[11px] font-bold text-gray-700 dark:text-gray-200">
              <span>{stage.label}</span>
              <span className="text-gray-400 dark:text-gray-500">{stage.note}</span>
            </div>
            <div className="mt-1 h-4 rounded-full bg-gray-100 dark:bg-gray-800">
              <div className="h-4 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: `${stage.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-gray-400 dark:text-gray-500">※ 目安の型。実数値は公開後のストア・利用ログで検証。</p>
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-800 dark:text-gray-200">{value}</p>
    </div>
  )
}

function ListBlock({ label, items, tone }: { label: string; items: string[]; tone: 'green' | 'amber' }) {
  const toneClass = {
    green: 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200',
  }[tone]
  const visibleItems = items.filter((item) => item.trim())

  return (
    <div>
      <p className="text-xs font-black text-gray-500 dark:text-gray-400">{label}</p>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {visibleItems.map((item) => (
            <li key={item} className={`rounded-lg border px-3 py-2 text-xs font-bold leading-relaxed ${toneClass}`}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm leading-relaxed text-gray-800 dark:text-gray-200">未記入</p>
      )}
    </div>
  )
}
