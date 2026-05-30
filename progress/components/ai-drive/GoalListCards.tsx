import type { AIDriveGoal } from '@/types/ai-drive'
import { StatusBadge, ImpactBadge } from './StatusBadge'

const reflectStyle = {
  pending: { label: 'Vault反映待ち', bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300' },
  synced: { label: 'Vault反映済', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300' },
  not_yet: { label: '未着手', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  'n/a': { label: 'n/a', bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500' },
}

const toolLabel: Record<string, string> = {
  claude_code: 'Claude Code',
  codex: 'Codex',
  chatgpt: 'ChatGPT',
  manual: '手動',
}

interface Props {
  goals: AIDriveGoal[]
}

export default function GoalListCards({ goals }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">AI自走ゴール一覧</h2>
      <div className="space-y-2">
        {goals.map((g) => {
          const refl = reflectStyle[g.vaultReflectStatus]
          return (
            <div
              key={g.id}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight flex-1 min-w-0">
                  {g.title}
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5 items-center">
                <StatusBadge status={g.status} />
                <ImpactBadge impact={g.monetizationImpact} />
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${refl.bg} ${refl.text}`}
                >
                  {refl.label}
                </span>
              </div>
              <div className="text-[12px] text-gray-600 dark:text-gray-300">
                <span className="text-gray-400 dark:text-gray-500">次アクション: </span>
                {g.nextAction}
              </div>
              <div className="text-[11px] text-gray-400 dark:text-gray-500">
                使用予定: {g.tools.map((t) => toolLabel[t] ?? t).join(' / ')}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
