import Link from 'next/link'
import type { Goal, GoalRole } from '@/types/goal'
import { calcGoalProgress, calcPhaseProgress, nextTodosByRole } from '@/lib/goal-reader'

interface Props {
  goal: Goal
  projectName?: string
}

const ROLE_META: Record<GoalRole, { label: string; emoji: string; cls: string }> = {
  human: { label: '人間', emoji: '🧑', cls: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200' },
  claude: { label: 'Claude', emoji: '🤖', cls: 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-200' },
  codex: { label: 'Codex', emoji: '✨', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200' },
}

export default function GoalSummaryCard({ goal, projectName }: Props) {
  const progress = calcGoalProgress(goal)
  const phases = calcPhaseProgress(goal)
  const next = nextTodosByRole(goal)

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-100 dark:border-blue-900/40 shadow-sm p-4 space-y-4">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">メイン目標</p>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-snug">{goal.title}</h2>
          {projectName && <p className="text-xs text-gray-500 dark:text-gray-400">案件: {projectName}</p>}
        </div>
        <Link href="/goal-planner" className="text-xs px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex-shrink-0">
          編集
        </Link>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>全体進捗</span>
          <span className="font-bold text-blue-700 dark:text-blue-300 text-base leading-none">{progress.ratio}%</span>
          <span className="text-gray-400 dark:text-gray-500">({progress.doneTodos} / {progress.totalTodos} 完了)</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all" style={{ width: `${progress.ratio}%` }} />
        </div>
      </div>

      {phases.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">ロードマップ</p>
          <ol className="space-y-1">
            {phases.map((p, i) => (
              <li key={p.phaseId} className="flex items-center gap-2">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${p.ratio === 100 ? 'bg-green-500 text-white' : p.done > 0 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-xs text-gray-700 dark:text-gray-200 truncate">{p.title}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">{p.done}/{p.total} · {p.ratio}%</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">今日のやること（次の一手）</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(['human', 'claude', 'codex'] as GoalRole[]).map((role) => {
            const todo = next[role]
            const meta = ROLE_META[role]
            return (
              <div key={role} className={`rounded-xl border px-3 py-2.5 ${meta.cls}`}>
                <p className="text-[11px] font-semibold flex items-center gap-1">
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </p>
                {todo ? (
                  <>
                    <p className="text-xs mt-1 leading-snug line-clamp-2 font-medium" title={todo.title}>{todo.title}</p>
                    {todo.nextAction && <p className="text-[10px] mt-0.5 opacity-80 line-clamp-2">→ {todo.nextAction}</p>}
                  </>
                ) : (
                  <p className="text-xs mt-1 opacity-60">残タスクなし</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1">
        {(['human', 'claude', 'codex'] as GoalRole[]).map((role) => {
          const meta = ROLE_META[role]
          return (
            <div key={role} className="rounded-xl bg-gray-50 dark:bg-gray-900/30 border border-gray-100 dark:border-gray-700 px-2 py-1.5 text-center">
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{meta.emoji} {meta.label} 残</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100 leading-tight">{progress.openPerRole[role]}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
