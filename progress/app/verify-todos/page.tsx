export const dynamic = 'force-dynamic'

import { readVerifyTodos } from '@/lib/verify-todos'
import { VerifyTodosBoard } from '@/components/verify-todos/VerifyTodosBoard'

export default async function VerifyTodosPage() {
  const registry = await readVerifyTodos()
  const todos = registry.todos

  const unconfirmed = todos.filter((t) => t.status === 'unconfirmed').length
  const confirmed = todos.filter((t) => t.status === 'confirmed').length
  const ng = todos.filter((t) => t.status === 'ng').length
  const pending = todos.filter((t) => t.status === 'pending').length

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">動作確認Todo</h1>
          <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
            人間が確認すべき画面・URL・手順の一元管理 / {todos.length} 件（未確認 {unconfirmed} / 確認済 {confirmed} / NG {ng} / 保留 {pending}）
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
          <strong>Claude Code / Codex の作業完了時・Epic 完了後</strong>に、人間が確認すべき項目（アプリ名・Epic名・確認URL・確認手順・期待結果）をこのページへ追加します。人間は確認URLを開き、手順どおりに操作して、期待結果と一致すれば <strong>確認済</strong>、ずれていれば <strong>NG</strong>、後回しなら <strong>保留</strong> に状態を更新します。
          {registry.operationMemo && (
            <span className="mt-2 block text-blue-800/80 dark:text-blue-200/80">{registry.operationMemo}</span>
          )}
        </div>
      </header>

      <VerifyTodosBoard initialTodos={todos} />
    </div>
  )
}
