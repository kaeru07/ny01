'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDevMode } from '@/lib/dev-mode'
import type {
  AutoFallbackResult,
  AutomationLogEntry,
  FallbackBlockKind,
  ClaudeLimitDetection,
  ClaudeLimitDetectResponse,
} from '@/lib/types/operations'

interface Props {
  /** 省略時は全体で評価 */
  epicId?: string
}

const BLOCK_LABEL: Record<FallbackBlockKind, string> = {
  disabled: '設定OFF',
  approval_required: 'approval_required',
  decision_required: 'decision_required',
  requires_approval: 'requires_approval',
  requires_claude: 'requires_claude',
  destructive: 'blocked（危険作業）',
  no_codex_candidate: 'blocked（候補なし）',
}

// blocked の理由ごとに「なぜ止まっているか + ワンタップ遷移先」を出す。
// 遷移先が無いもの（Claude担当 / 危険作業 / 候補なし）は説明のみ。
const BLOCK_ACTION: Record<FallbackBlockKind, { why: string; href?: string; cta?: string }> = {
  disabled: { why: '設定がOFFです', href: '/automation', cta: '設定を確認' },
  approval_required: { why: '承認待ちがあります', href: '/approvals', cta: '承認ページへ' },
  requires_approval: { why: '対象作業が承認待ちです', href: '/approvals', cta: '承認ページへ' },
  decision_required: { why: 'Decisionが未確定です', href: '/decisions', cta: 'Decisionページへ' },
  requires_claude: { why: 'Claude担当の作業です（Codex不可）' },
  destructive: { why: '危険作業のためClaude担当です' },
  no_codex_candidate: { why: 'Codexへ渡せる安全な作業がありません' },
}

const SOURCE_LABEL: Record<string, string> = {
  'execution-run': 'ExecutionRun',
  'vloop-log': 'vloopログ',
  'automation-log': 'AutomationLog',
}

export default function AutoFallbackPanel({ epicId }: Props) {
  const [result, setResult] = useState<AutoFallbackResult | null>(null)
  const [detection, setDetection] = useState<ClaudeLimitDetection | null>(null)
  const [log, setLog] = useState<AutomationLogEntry[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'detecting' | 'copied' | 'error'>('idle')
  const autoFiredRef = useRef(false)
  const [devMode] = useDevMode()

  const loadLog = useCallback(async () => {
    const res = await fetch('/api/operations/automation-log?limit=5', { cache: 'no-store' })
    setLog(res.ok ? await res.json() : [])
  }, [])

  // 検知のみ（副作用なし）。detected のときだけ自動で fallback 評価を 1 回発火する。
  const detect = useCallback(async () => {
    setState('detecting')
    try {
      const res = await fetch('/api/operations/claude-limit', { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { detection: ClaudeLimitDetection }
      setDetection(data.detection)
      setState('idle')
      if (data.detection.recommendation === 'trigger_fallback' && !autoFiredRef.current) {
        autoFiredRef.current = true
        await autoEvaluate()
      }
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
    // autoEvaluate はコンポーネント内のローカル関数（毎renderで再生成）。意図的に依存から外す。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadLog()
    detect()
  }, [loadLog, detect])

  // 検知結果に基づく自動評価（POST）。安全ゲートは既存のまま。
  async function autoEvaluate() {
    setState('loading')
    try {
      const res = await fetch('/api/operations/claude-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as ClaudeLimitDetectResponse
      setDetection(data.detection)
      if (data.fallback) setResult(data.fallback)
      setState('idle')
      loadLog()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  // 手動上書き（従来の「Claude上限として扱う」）。検知が none/ambiguous でも強制評価する。
  async function manualTrigger() {
    setState('loading')
    try {
      const res = await fetch('/api/operations/claude-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epicId, force: true }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as ClaudeLimitDetectResponse
      setDetection(data.detection)
      if (data.fallback) setResult(data.fallback)
      setState('idle')
      loadLog()
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  async function copy() {
    if (!result?.prompt) return
    try {
      await navigator.clipboard.writeText(result.prompt.promptText)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  return (
    <div>
      {/* 自動検知ステータス */}
      <DetectionBanner detection={detection} busy={state === 'detecting'} onRecheck={detect} />

      {/* 手動上書き（開発者モード限定。通常運用は自動検知に任せる） */}
      {devMode && (
        <button
          onClick={manualTrigger}
          disabled={state === 'loading'}
          className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
        >
          {state === 'loading' ? '判定中…' : '⚠ 手動: Claude上限として扱う（開発者モード）'}
        </button>
      )}

      {result && result.status === 'codex_ready' && (
        <div className="mt-3 rounded-xl border border-green-300 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
          <p className="text-sm font-bold text-green-800 dark:text-green-300">Claude上限を検知しました</p>
          <p className="text-xs text-green-700 dark:text-green-400">Codex引き継ぎ候補があります</p>
          <div className="mt-2 space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
            <p>対象: {result.epicTitle ?? '全体（現在のコンテキスト）'}</p>
            <p>安全判定: <span className="font-semibold text-green-700">OK</span>（{result.safetyGuard ? '安全判定ガード付き' : '—'}）</p>
            {result.codexPromptSourceRunId && <p>元Run: {result.codexPromptSourceRunId}</p>}
          </div>
          <button
            onClick={copy}
            className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${state === 'copied' ? 'bg-green-600' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {state === 'copied' ? '✓ コピーしました（Codexへ貼り付け）' : 'Codex用プロンプトをコピー'}
          </button>
          {result.prompt && (
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] leading-relaxed text-gray-700 dark:bg-gray-900 dark:text-gray-300">
{result.prompt.promptText}
            </pre>
          )}
        </div>
      )}

      {result && result.status === 'blocked' && (
        <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20">
          <p className="text-sm font-bold text-rose-800 dark:text-rose-300">なぜ止まっているか</p>
          <p className="text-xs text-rose-700 dark:text-rose-400">安全判定でブロックされました（Codexプロンプトは生成していません）。下のボタンから対象ページへ進めます。</p>
          <ul className="mt-2 space-y-2">
            {result.blocked.map((b, i) => {
              const action = BLOCK_ACTION[b.kind]
              return (
                <li key={i} className="rounded-lg border border-rose-200 bg-white/60 p-2 dark:border-rose-900/40 dark:bg-gray-900/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs text-gray-700 dark:text-gray-300">
                      <span className="mr-1 rounded bg-rose-100 px-1.5 py-0.5 font-mono text-[10px] text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">{BLOCK_LABEL[b.kind]}</span>
                      <span className="font-medium">{action.why}</span>
                      <p className="mt-0.5 text-[11px] text-gray-500">{b.reason}</p>
                    </div>
                    {action.href && (
                      <Link
                        href={action.href}
                        className="shrink-0 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700"
                      >
                        {action.cta} →
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-medium text-gray-400">Automation Log（直近）</p>
          <ul className="space-y-1">
            {log.map((e) => (
              <li key={e.id} className="text-[11px] text-gray-500">
                {new Date(e.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ·{' '}
                {e.event === 'claude_limit_detection'
                  ? `検知: ${e.detectionStatus ?? '-'}（${e.detectionConfidence ?? '-'} / signals ${e.signalCount ?? 0}）`
                  : `${e.fallbackReason ?? '-'} · ${e.codexPromptGenerated ? 'codex_ready' : `blocked(${e.blockedReason ?? '-'})`}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function DetectionBanner({
  detection,
  busy,
  onRecheck,
}: {
  detection: ClaudeLimitDetection | null
  busy: boolean
  onRecheck: () => void
}) {
  const status = detection?.status ?? 'none'
  const style =
    status === 'detected'
      ? { box: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20', label: '上限を自動検知', cls: 'text-green-700' }
      : status === 'ambiguous'
        ? { box: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20', label: '要確認（誤判定回避でblocked）', cls: 'text-amber-700' }
        : { box: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40', label: '上限シグナルなし', cls: 'text-gray-500' }

  return (
    <div className={`rounded-xl border p-3 ${style.box}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${style.cls}`}>自動検知: {style.label}</p>
        <button onClick={onRecheck} disabled={busy} className="text-[11px] text-blue-600 underline disabled:opacity-50">
          {busy ? '検知中…' : '再検知'}
        </button>
      </div>
      {detection && (
        <>
          <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
            確度: {detection.confidence} / 推奨: {detection.recommendation} / 窓: {detection.windowMinutes}分
          </p>
          <p className="text-[11px] text-gray-500">{detection.reason}</p>
          {detection.signals.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {detection.signals.slice(0, 4).map((s, i) => (
                <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300">
                  <span className="mr-1 rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[10px] text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {SOURCE_LABEL[s.source] ?? s.source}·{s.weight}
                  </span>
                  {s.field}={s.pattern}（{s.ref}）
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
