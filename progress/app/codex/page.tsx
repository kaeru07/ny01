export const dynamic = 'force-dynamic'

import { listCodexRuns } from '@/lib/codex-run-storage'
import CodexStatusCard from '@/components/codex/CodexStatusCard'
import CodexManualForm from '@/components/codex/CodexManualForm'
import CodexRunList from '@/components/codex/CodexRunList'

export default async function CodexPage() {
  const runs = await listCodexRuns(100)

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Codex 実験
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          VPS の codex CLI をサーバー側から手動で 1 件ずつ実行する実験機能。
          自動ループ・cron・並列実行はしません。
        </p>
      </header>

      <CodexStatusCard />
      <CodexManualForm />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          実行履歴 ({runs.length})
        </h2>
        <CodexRunList runs={runs} />
      </section>
    </div>
  )
}
