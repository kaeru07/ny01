'use client'

import type { AIDriveGoal } from '@/types/ai-drive'
import { StatusBadge, ImpactBadge } from './StatusBadge'

interface MainGoalCardProps {
  goal: AIDriveGoal
}

export default function MainGoalCard({ goal }: MainGoalCardProps) {
  function handleClick(action: string) {
    // v1: 見た目だけのモック。本実装で API → progress 反映へ繋ぐ想定
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log(`[ai-drive mock] ${action} on goal "${goal.title}"`)
      alert(`(mock) ${action}: ${goal.title}`)
    }
  }

  return (
    <section className="bg-gradient-to-br from-amber-50 to-rose-50 dark:from-amber-950/40 dark:to-rose-950/40 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
            🔥 現在の最重要ゴール
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1 leading-tight">{goal.title}</h2>
        </div>
      </div>

      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{goal.purpose}</p>

      <div className="flex flex-wrap gap-2 items-center">
        <StatusBadge status={goal.status} />
        <ImpactBadge impact={goal.monetizationImpact} />
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          tools: {goal.tools.join(' / ')}
        </span>
      </div>

      {goal.decisionsNeeded && goal.decisionsNeeded.length > 0 && (
        <div className="bg-white/60 dark:bg-gray-900/60 rounded-xl p-3 space-y-1.5">
          <div className="text-xs font-semibold text-amber-700 dark:text-amber-300">次に必要な判断</div>
          <ul className="text-sm text-gray-800 dark:text-gray-200 space-y-1">
            {goal.decisionsNeeded.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">▸</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => handleClick('承認する')}
          className="bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl py-3 transition-colors"
        >
          ✓ 承認する
        </button>
        <button
          onClick={() => handleClick('修正して再計画')}
          className="bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white text-sm font-semibold rounded-xl py-3 transition-colors"
        >
          ↻ 修正して再計画
        </button>
        <button
          onClick={() => handleClick('保留')}
          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 active:scale-[0.98] text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl py-3 transition-colors"
        >
          ⏸ 保留
        </button>
        <button
          onClick={() => handleClick('詳細を見る')}
          className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] text-gray-700 dark:text-gray-200 text-sm font-semibold rounded-xl py-3 transition-colors"
        >
          詳細を見る →
        </button>
      </div>
    </section>
  )
}
