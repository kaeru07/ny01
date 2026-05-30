import type { AIDriveStage } from '@/types/ai-drive'

const stages: { id: AIDriveStage; label: string; short: string }[] = [
  { id: 'goal', label: 'ゴール', short: 'Goal' },
  { id: 'plan', label: '計画', short: 'Plan' },
  { id: 'human_gate', label: '人間ゲート', short: 'Human Gate' },
  { id: 'execute', label: '実行', short: 'Execute' },
  { id: 'execution_run', label: '実行記録', short: 'ExecutionRun' },
  { id: 'review', label: 'レビュー', short: 'Review' },
  { id: 'next_loop', label: '次ループ', short: 'Next Loop' },
]

interface StageFlowProps {
  currentStage: AIDriveStage
}

export default function StageFlow({ currentStage }: StageFlowProps) {
  const currentIndex = stages.findIndex((s) => s.id === currentStage)

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">AI自走ステージ</h2>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
        {stages.map((stage, i) => {
          const isCurrent = stage.id === currentStage
          const isPast = i < currentIndex
          const isFuture = i > currentIndex
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 snap-start rounded-xl px-3 py-2 min-w-[88px] text-center transition-colors ${
                isCurrent
                  ? 'bg-amber-500 text-white ring-2 ring-amber-300 dark:ring-amber-700 shadow-md'
                  : isPast
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-75">{stage.short}</div>
              <div className="text-sm font-semibold leading-tight mt-0.5">
                {isPast ? '✓ ' : isFuture ? '' : '▶ '}
                {stage.label}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 pl-1">
        {currentStage === 'human_gate'
          ? '⚠ 人間ゲートで停止中。承認・修正・保留のいずれかを選択してください。'
          : '黄=現在 / 緑=完了 / 灰=未着手'}
      </p>
    </section>
  )
}
