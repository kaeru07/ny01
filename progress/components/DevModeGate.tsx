'use client'

import { useDevMode } from '@/lib/dev-mode'

// 開発者モード時のみ children を表示する。通常ユーザーには手動 Executor 操作を見せない。
export default function DevModeGate({ children }: { children: React.ReactNode }) {
  const [on] = useDevMode()
  if (!on) return null
  return (
    <div className="rounded-xl border border-dashed border-purple-300 bg-purple-50/30 p-2 dark:border-purple-800/60 dark:bg-purple-900/10">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-purple-500">開発者モード限定</p>
      {children}
    </div>
  )
}

// 開発者モードの ON/OFF トグル。Automation 画面下部に置く。
export function DevModeToggle() {
  const [on, set] = useDevMode()
  return (
    <button
      onClick={() => set(!on)}
      className={`w-full rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
        on
          ? 'bg-purple-600 text-white hover:bg-purple-700'
          : 'border border-gray-300 text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800'
      }`}
    >
      {on ? '開発者モード: ON（手動 Executor 操作を表示中）' : '開発者モード: OFF（通常運用 / Executor は内部状態）'}
    </button>
  )
}
