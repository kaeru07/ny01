interface HeaderProps {
  runningCount: number
  needsDecisionCount: number
  reviewWaitingCount: number
  vaultReflectPending: number
  monetizationHighCount: number
}

export default function Header({
  runningCount,
  needsDecisionCount,
  reviewWaitingCount,
  vaultReflectPending,
  monetizationHighCount,
}: HeaderProps) {
  const stats = [
    { label: '進行中', value: runningCount, accent: 'text-blue-600 dark:text-blue-400' },
    { label: '人間判断待ち', value: needsDecisionCount, accent: 'text-amber-600 dark:text-amber-400' },
    { label: 'レビュー待ち', value: reviewWaitingCount, accent: 'text-purple-600 dark:text-purple-400' },
    { label: 'Vault反映待ち', value: vaultReflectPending, accent: 'text-teal-600 dark:text-teal-400' },
    { label: '収益化High', value: monetizationHighCount, accent: 'text-rose-600 dark:text-rose-400' },
  ]

  return (
    <header className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI自走</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
          ゴールから AI が計画・実行・検証・レビュー・次アクション生成まで回すための司令塔。
          <span className="block text-xs text-gray-400 dark:text-gray-500 mt-1">
            v1 モックアップ / Vault 連携・自動実行は未接続
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2"
          >
            <div className={`text-xl font-bold ${s.accent}`}>{s.value}</div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">{s.label}</div>
          </div>
        ))}
      </div>
    </header>
  )
}
