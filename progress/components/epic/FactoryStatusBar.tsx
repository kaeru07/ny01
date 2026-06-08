'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type {
  HealthSummary,
  AutomationReadiness,
  ClaudeLimitDetection,
} from '@/lib/types/operations'

// 工場の「現在地表示」。既存データ（health / automation readiness / claude上限検知）だけから
// 「今なにをすればいいか」を一目で出す。判定ロジックは持ち込まず、既存APIの結果を読むだけ。

type StateKey = 'claude_limit' | 'approval' | 'working' | 'codex_ready' | 'idle' | 'loading'

interface StateView {
  emoji: string
  label: string
  guide: string
  cta?: { href: string; label: string }
  cls: string
}

function decideState(
  health: HealthSummary | null,
  readiness: AutomationReadiness | null,
  detection: ClaudeLimitDetection | null,
): { key: StateKey; view: StateView } {
  if (!health && !readiness && !detection) {
    return { key: 'loading', view: { emoji: '⏳', label: '読み込み中', guide: '状態を確認しています…', cls: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40' } }
  }

  const pending = health?.pendingApproval ?? 0
  const running = health?.running ?? 0
  const runnable = health?.runnable ?? 0
  const canCodex = readiness?.restartReadiness.canFallbackToCodex ?? false

  // 優先度: Claude上限 > 承認待ち > 作業中 > Codex引き継ぎ可能 > 待機
  if (detection && detection.status === 'detected') {
    return {
      key: 'claude_limit',
      view: {
        emoji: '🔴',
        label: 'Claude上限',
        guide: 'Claudeが上限で止まっています。Codexへ引き継ぐか、上限解除を待ちます。',
        cta: { href: '/automation', label: 'Codexへ引き継ぐ' },
        cls: 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20',
      },
    }
  }
  if (detection && detection.status === 'ambiguous') {
    return {
      key: 'claude_limit',
      view: {
        emoji: '🔴',
        label: 'Claude上限の可能性（要確認）',
        guide: '失敗ログを検知しましたが上限か確定できません。Automationで内容を確認してください。',
        cta: { href: '/automation', label: 'Automationで確認' },
        cls: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
      },
    }
  }
  if (pending > 0) {
    return {
      key: 'approval',
      view: {
        emoji: '🟡',
        label: `承認待ち ${pending}件`,
        guide: 'AIの作業が承認を待っています。内容を確認して承認/却下してください。',
        cta: { href: '/approvals', label: '承認ページへ' },
        cls: 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20',
      },
    }
  }
  if (running > 0) {
    return {
      key: 'working',
      view: {
        emoji: '🟢',
        label: `作業中 ${running}件`,
        guide: 'AIが作業中です。完了後に結果レビュー→承認へ進みます。',
        cls: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
      },
    }
  }
  if (canCodex) {
    return {
      key: 'codex_ready',
      view: {
        emoji: '🟣',
        label: 'Codex引き継ぎ可能',
        guide: 'Codexで安全に進められる作業があります。Claude上限時はCodexへ引き継げます。',
        cta: { href: '/automation', label: 'Codexへ引き継ぐ' },
        cls: 'border-purple-300 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20',
      },
    }
  }
  return {
    key: 'idle',
    view: {
      emoji: '⚪',
      label: runnable > 0 ? `待機中（実行可能 ${runnable}件）` : '待機中',
      guide: runnable > 0 ? 'Epicを開いて「続きから実行」で作業を始められます。' : '実行可能な作業はありません。Epicを開いて次の作業を準備します。',
      cls: 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40',
    },
  }
}

export default function FactoryStatusBar() {
  const [health, setHealth] = useState<HealthSummary | null>(null)
  const [readiness, setReadiness] = useState<AutomationReadiness | null>(null)
  const [detection, setDetection] = useState<ClaudeLimitDetection | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([
      fetch('/api/operations/health', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/operations/automation', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/operations/claude-limit', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([h, a, d]) => {
      if (!alive) return
      setHealth(h)
      setReadiness(a)
      setDetection(d?.detection ?? null)
    })
    return () => {
      alive = false
    }
  }, [])

  const { view } = decideState(health, readiness, detection)

  return (
    <div className={`rounded-2xl border p-4 ${view.cls}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none" aria-hidden>{view.emoji}</span>
          <div>
            <p className="text-[11px] font-medium text-gray-400">いまの状態</p>
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{view.label}</p>
          </div>
        </div>
        {view.cta && (
          <Link
            href={view.cta.href}
            className="shrink-0 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-white dark:bg-gray-800/80 dark:text-blue-300 dark:hover:bg-gray-800"
          >
            {view.cta.label} →
          </Link>
        )}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{view.guide}</p>
    </div>
  )
}
