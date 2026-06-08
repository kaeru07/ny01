'use client'

import { useCallback, useEffect, useState } from 'react'
import type {
  FactoryOverview,
  FactoryDisplayState,
  ExecutorDisplay,
  LaunchMethod,
} from '@/lib/factory-overview'

// Factory状態カード（可視化のみ）。
// /api/operations/factory-overview を読むだけ。状態判定・Factory ロジックは持たない。
// 一般ユーザーが「ON/OFF・次回起動・実行中か・停止理由・Claude上限・Codex待機」を一目で分かる表現にする。

// ユーザー向け状態 → 表示（日本語ラベル + 色 + 絵文字）。開発者語は出さない。
const STATE_VIEW: Record<
  FactoryDisplayState,
  { label: string; emoji: string; cls: string; badge: string }
> = {
  Running: {
    label: '実行中',
    emoji: '🟢',
    cls: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
    badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  },
  'Approval Required': {
    label: '承認待ち',
    emoji: '🟡',
    cls: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  'Codex Ready': {
    label: 'Codex 待機中',
    emoji: '🟣',
    cls: 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  Blocked: {
    label: '停止中（作業なし）',
    emoji: '🔴',
    cls: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  Paused: {
    label: '一時停止中',
    emoji: '🟠',
    cls: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  },
  OFF: {
    label: 'OFF（停止）',
    emoji: '⚪',
    cls: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40',
    badge: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  },
}

const EXECUTOR_LABEL: Record<ExecutorDisplay, string> = {
  Claude: 'Claude',
  Codex: 'Codex',
  None: 'なし',
}

const LAUNCH_LABEL: Record<LaunchMethod, string> = {
  Manual: '手動',
  Schedule: '定時',
  Boot: '起動時',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '未設定'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '未設定'
  return (
    d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' JST'
  )
}

function fmtRunTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function FactoryStatusCard() {
  const [s, setS] = useState<FactoryOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/operations/factory-overview', { cache: 'no-store' })
      setS(res.ok ? await res.json() : null)
    } catch {
      setS(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !s) {
    return (
      <section className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-400 dark:border-gray-800">
        Factory 状態を読み込み中…
      </section>
    )
  }
  if (!s) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600 dark:border-rose-800 dark:bg-rose-900/20">
        Factory 状態を取得できませんでした。
        <button onClick={load} className="ml-2 underline">
          再読み込み
        </button>
      </section>
    )
  }

  const view = STATE_VIEW[s.state]

  return (
    <section className={`rounded-2xl border p-4 ${view.cls}`}>
      {/* ヘッダ: 状態を最大表示 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none" aria-hidden>
            {view.emoji}
          </span>
          <div>
            <p className="text-[11px] font-medium text-gray-400">Factory の状態</p>
            <p className="text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
              {view.label}
            </p>
          </div>
        </div>
        <button onClick={load} className="shrink-0 text-[11px] text-blue-600 underline">
          更新
        </button>
      </div>

      {/* 実行中Epic / 停止理由 */}
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-gray-900/40">
        <Line label="実行中のEpic" value={s.currentEpic ?? 'なし'} strong={!!s.currentEpic} />
        {s.stopReason && (
          <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300">
            <span className="font-semibold">停止理由:</span> {s.stopReason}
          </p>
        )}
      </div>

      {/* 主要グリッド（モバイル2列 / sm 以上3列） */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Cell label="実行者" value={EXECUTOR_LABEL[s.executor]} />
        <Cell label="次回起動" value={fmtDateTime(s.nextRunAt)} small />
        <Cell label="起動方式" value={LAUNCH_LABEL[s.launchMethod]} />
        <Cell
          label="Claude"
          value={
            s.claude === 'Available'
              ? '正常'
              : s.claude === 'Rate Limited'
                ? '上限中'
                : '不明'
          }
          tone={s.claude === 'Rate Limited' ? 'warn' : s.claude === 'Available' ? 'ok' : undefined}
        />
        <Cell
          label="Codex"
          value={s.codex === 'Ready' ? '待機OK' : '利用不可'}
          tone={s.codex === 'Ready' ? 'ok' : undefined}
        />
        <Cell
          label="自動切替"
          value={s.autoFallback ? '有効' : '無効'}
          tone={s.autoFallback ? 'ok' : undefined}
        />
      </div>

      {/* 最終Run */}
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] dark:bg-gray-900/40">
        <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">最終Run</p>
        {s.lastRun.runId ? (
          <dl className="space-y-0.5 text-gray-600 dark:text-gray-300">
            <Row k="ID" v={s.lastRun.runId} />
            <Row k="実行時刻" v={fmtRunTime(s.lastRun.finishedAt)} />
            <Row k="実行者" v={EXECUTOR_LABEL[s.lastRun.executorUsed]} />
            <Row k="起動方式" v={LAUNCH_LABEL[s.lastRun.launchMethod]} />
          </dl>
        ) : (
          <p className="text-gray-400">まだ実行履歴がありません</p>
        )}
      </div>

      {/* スケジュール設定 */}
      <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-[11px] dark:bg-gray-900/40">
        <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">スケジュール設定</p>
        <dl className="space-y-0.5 text-gray-600 dark:text-gray-300">
          <Row
            k="毎日（定時）"
            v={
              s.schedule.timerEnabled
                ? `${s.schedule.dailyTime ?? '—'} JST`
                : s.schedule.dailyTime
                  ? `${s.schedule.dailyTime} JST（未有効化）`
                  : '未設定'
            }
          />
          <Row k="起動時（Boot）" v={s.schedule.bootEnabled ? '有効' : '無効'} />
        </dl>
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        この画面は状態の確認専用です。実行者（Claude / Codex）は自動で選ばれます。
      </p>
    </section>
  )
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span
        className={`text-right text-sm ${strong ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
      >
        {value}
      </span>
    </div>
  )
}

function Cell({
  label,
  value,
  tone,
  small,
}: {
  label: string
  value: string
  tone?: 'ok' | 'warn'
  small?: boolean
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-green-700 dark:text-green-300'
      : tone === 'warn'
        ? 'text-rose-700 dark:text-rose-300'
        : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-lg bg-white/70 px-2.5 py-2 dark:bg-gray-900/40">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`mt-0.5 font-bold ${small ? 'text-[11px] leading-tight' : 'text-sm'} ${toneCls}`}>
        {value}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="shrink-0 text-gray-400">{k}</dt>
      <dd className="break-all text-right text-gray-700 dark:text-gray-200">{v}</dd>
    </div>
  )
}
