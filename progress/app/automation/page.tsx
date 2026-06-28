'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AutomationReadiness, HealthSummary, AutomationConfig, ExecutorSummary } from '@/lib/types/operations'
import CodexHandoffPanel from '@/components/codex/CodexHandoffPanel'
import CodexReportForm from '@/components/codex/CodexReportForm'
import AutoFallbackPanel from '@/components/codex/AutoFallbackPanel'
import AutoResumePanel from '@/components/automation/AutoResumePanel'
import FactoryDispatchPanel from '@/components/automation/FactoryDispatchPanel'
import FactoryProgressCard from '@/components/automation/FactoryProgressCard'
import FactoryStatusCard from '@/components/automation/FactoryStatusCard'
import LoopHealthCard from '@/components/automation/LoopHealthCard'
import FactoryRunnerPanel from '@/components/automation/FactoryRunnerPanel'
import DevModeGate, { DevModeToggle } from '@/components/DevModeGate'

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

// Codex 自動切替ポリシー（表示用。判定の実体は lib/operations-store classifyCodexEligibility）
const CODEX_OK = ['UI修正', 'lint', 'typecheck', 'build', 'テスト', 'Vault整理', 'Issue整理', '方針決定済みの実装']
const CODEX_NG = ['課金', '本番DB', '認証情報', 'destructive操作', '外部公開', '方針未決定の設計']

export default function AutomationPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [autoexec, setAutoexec] = useState<AutoexecStatus | null>(null)
  const [automation, setAutomation] = useState<AutomationReadiness | null>(null)
  const [config, setConfig] = useState<AutomationConfig | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    const [h, a, au, cfg] = await Promise.all([
      getJson<HealthSummary>('/api/operations/health').catch(() => null),
      getJson<AutoexecStatus>('/api/operations/autoexec').catch(() => null),
      getJson<AutomationReadiness>('/api/operations/automation').catch(() => null),
      getJson<AutomationConfig>('/api/operations/automation-config').catch(() => null),
    ])
    setHealth(h)
    setAutoexec(a)
    setAutomation(au)
    setConfig(cfg)
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

  async function patchConfig(patch: Partial<AutomationConfig>) {
    setBusy(true)
    try {
      const res = await fetch('/api/operations/automation-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      setConfig(await res.json())
    } finally {
      setBusy(false)
    }
  }

  // 現在状態: pm2 が online なら running、承認待ちがあれば blocked、それ以外 paused
  const runState =
    (health?.pendingApproval ?? 0) > 0
      ? { label: 'blocked（承認待ち）', cls: 'bg-rose-100 text-rose-700' }
      : autoexec?.status === 'online'
        ? { label: 'running', cls: 'bg-green-100 text-green-700' }
        : { label: 'paused', cls: 'bg-gray-200 text-gray-600' }

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Automation</h1>
        <p className="mt-0.5 text-sm text-gray-400">AI工場のエンジン。状態中心で確認する（Executor は内部状態）。</p>
      </header>

      {/* Factory状態カード（最上位・一般ユーザー向けの一目確認） */}
      <FactoryStatusCard />

      {/* Factory 進行状況（状態中心・詳細） */}
      <FactoryProgressCard />

      {/* ループの健全性（実行→レビュー→学び→次Epic候補が閉じているか） */}
      <LoopHealthCard />

      {/* 現在状態 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">現在状態</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${runState.cls}`}>{runState.label}</span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          <Stat label="実行可" value={health?.runnable} />
          <Stat label="実行中" value={health?.running} />
          <Stat label="承認待ち" value={health?.pendingApproval} warn={(health?.pendingApproval ?? 0) > 0} />
          <Stat label="停止" value={health?.stopped} />
        </div>
      </section>

      {/* 自動実行コントロール (vloop) */}
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">自動実行 (vloop)</span>
          <span className="text-xs text-gray-500">
            {autoexec?.name ?? '—'}:{' '}
            <span className={autoexec?.status === 'online' ? 'font-medium text-green-600' : 'text-gray-500'}>
              {autoexec?.status ?? '不明'}
            </span>
          </span>
        </div>
        <div className="mt-3 flex gap-2">
          <button disabled={busy} onClick={() => controlAutoexec('start')} className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-50">開始</button>
          <button disabled={busy} onClick={() => controlAutoexec('stop')} className="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">停止</button>
          <button disabled={busy} onClick={() => controlAutoexec('restart')} className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">再開</button>
        </div>
      </section>

      {/* Executor 設定 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Executor</h2>
        <p className="mt-0.5 text-[11px] text-gray-400">Claude 上限で止まらないための実行者設定（設定値は保存。自動発火の実装は後続）</p>

        <div className="mt-3">
          <p className="mb-1 text-xs text-gray-500">既定の実行者</p>
          <div className="flex gap-2">
            {(['claude', 'codex', 'both'] as const).map((mode) => (
              <button
                key={mode}
                disabled={busy}
                onClick={() => patchConfig({ executorMode: mode })}
                className={`flex-1 rounded-lg px-3 py-2 text-sm capitalize disabled:opacity-50 ${
                  config?.executorMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {mode === 'both' ? 'Both' : mode}
              </button>
            ))}
          </div>
        </div>

        <Toggle
          className="mt-4"
          label="Auto Resume"
          desc="Claude上限後に安全な作業だけ自動再開（下に状態・再開件数・最終再開時刻）"
          on={config?.autoResume ?? false}
          busy={busy}
          onChange={(v) => patchConfig({ autoResume: v })}
        />
        <Toggle
          className="mt-3"
          label="Auto Fallback"
          desc="Claude 不可時に Codex 適格な作業を自動で Codex へ（実装は後続）"
          on={config?.autoFallback ?? false}
          busy={busy}
          onChange={(v) => patchConfig({ autoFallback: v })}
        />

        {/* 深掘り回数（同一Epicを1起動内で何Run回すか）。1=毎Run別Epicへローテ / 3=同Epicを最大3回深掘り */}
        <div className="mt-4">
          <p className="mb-0.5 text-xs text-gray-500">1サイクルの深掘り回数</p>
          <p className="mb-1 text-[11px] text-gray-400">
            同じEpicを1起動内で何回まで掘るか。1=毎回ちがうEpicへ / 3=同じEpicを最大3回（既定）
          </p>
          <div className="flex gap-2">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                disabled={busy}
                onClick={() => patchConfig({ factoryMaxPerEpic: n })}
                className={`flex-1 rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${
                  (config?.factoryMaxPerEpic ?? 3) === n ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}
              >
                {n}回
              </button>
            ))}
          </div>
        </div>

        {/* Auto Resume 状態（Claude上限後に安全作業だけ自動継続） */}
        <div className="mt-4">
          <AutoResumePanel />
        </div>

        {automation && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {automation.executors
              .filter((e) => e.executor === 'claude' || e.executor === 'codex')
              .map((e) => (
                <ExecutorCard key={e.executor} executor={e} />
              ))}
          </div>
        )}
      </section>

      {/* Auto Fallback（Claude上限検知 → 安全判定 → Codexプロンプト自動生成） */}
      <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-800/60 dark:bg-amber-900/10">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Auto Fallback</h2>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-500">
          vloop実行ログ / ExecutionRun / Automation Log から Claude 上限を自動検知 → 検知時のみ厳格な安全判定 → OK なら Codex プロンプト自動生成・通知（Codex は自動起動しません）。誤判定時は blocked。手動上書きは開発者モード時のみ。
        </p>
        <AutoFallbackPanel />
      </section>

      {/* Factory Runner（開発者モード限定 / 既定 dry-run・caps付き） */}
      <DevModeGate>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-900/10">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Factory Runner（自動実行・実験）</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-gray-500">
            scan→pick→Dispatch→（adapter で）Run→ExecutionRun 記録→Epic 内ループ。既定 dry-run（実起動なし）。auto は claude/codex を実起動するため確認チェック必須。
          </p>
          <FactoryRunnerPanel />
        </section>
      </DevModeGate>

      {/* Factory Dispatch（手動 executor 選択・開発者モード限定 / 疎通テスト用） */}
      <DevModeGate>
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 dark:border-indigo-800/60 dark:bg-indigo-900/10">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Factory Dispatch（準備・手動）</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-gray-500">
            手動で Epic を Claude / Codex へ渡す準備（疎通テスト用）。通常運用では Executor は内部で自動選択され、ユーザーは選びません。riskFlags / 承認待ち / 決定待ち / manual は dispatch 不可。
          </p>
          <FactoryDispatchPanel />
        </section>
      </DevModeGate>

      {/* Codex へ引き継ぐ（手動・開発者モード限定。通常運用は AutoFallback が自動生成） */}
      <DevModeGate>
        <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Codexへ引き継ぐ（手動）</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-gray-400">開発・デバッグ用の手動引き継ぎ。通常運用では Claude 上限時に AutoFallback が自動で Codex プロンプトを生成します。</p>
          <CodexHandoffPanel />
        </section>
      </DevModeGate>

      {/* Codex 結果を戻す */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Codex 結果を戻す</h2>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-400">Codex の作業報告を ExecutionRun として登録（executorUsed=codex / source=codex_mobile）</p>
        <CodexReportForm />
      </section>

      {/* Codex 自動切替ポリシー */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Codex 自動切替ポリシー</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-xs font-medium text-green-600">Codex へ渡せる</p>
            <ul className="space-y-1">
              {CODEX_OK.map((x) => <li key={x} className="text-[11px] text-gray-600 dark:text-gray-300">✓ {x}</li>)}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-rose-600">Claude 専任</p>
            <ul className="space-y-1">
              {CODEX_NG.map((x) => <li key={x} className="text-[11px] text-gray-600 dark:text-gray-300">✗ {x}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">最終ゲートは requiresClaude フラグと Approval Queue。危険作業は Codex へ渡さない。</p>
      </section>

      {/* 次回実行予定 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">次回実行予定</h2>
        {automation && automation.aiGeneratedTodos.candidates.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {automation.aiGeneratedTodos.candidates.slice(0, 5).map((c, i) => (
              <li key={`${c.sourceRunId}-${i}`} className="text-sm text-gray-800 dark:text-gray-200">
                <span className="text-gray-400">・</span> {c.title}
                <span className="ml-1 text-[11px] text-gray-400">（{c.targetApp}）</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-400">次回実行予定はありません</p>
        )}
      </section>

      {/* 開発者モード切替（手動 Executor 操作の表示制御） */}
      <DevModeToggle />

      {/* Factory（今後・配置のみ） */}
      <section className="rounded-2xl border border-dashed border-gray-200 p-4 opacity-60 dark:border-gray-800">
        <h2 className="mb-1 text-sm font-bold text-gray-400">Factory（今後・未実装）</h2>
        <p className="text-[11px] text-gray-400">
          Automation = 実行制御（人が start/stop、設定を決める）。Factory = 承認不要の作業を無人で連続実行する上位レイヤ。Auto Resume / Auto Fallback が安定してから着手。
        </p>
      </section>
    </div>
  )
}

function Stat({ label, value, warn }: { label: string; value?: number; warn?: boolean }) {
  return (
    <div className={`rounded-lg py-2 ${warn ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value ?? '–'}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  )
}

function ExecutorCard({ executor }: { executor: ExecutorSummary }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50">
      <div className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{executor.executor}</div>
      <div className="mt-1 text-[11px] text-gray-500">実行可 {executor.runnable} / 実行中 {executor.running}</div>
      <div className="text-[11px] text-gray-400">完了 {executor.completedRuns} / 失敗 {executor.failedRuns}</div>
    </div>
  )
}

function Toggle({
  label, desc, on, busy, onChange, className,
}: {
  label: string
  desc: string
  on: boolean
  busy: boolean
  onChange: (v: boolean) => void
  className?: string
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className ?? ''}`}>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-[11px] text-gray-400">{desc}</p>
      </div>
      <button
        disabled={busy}
        onClick={() => onChange(!on)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
        aria-pressed={on}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
