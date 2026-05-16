export const dynamic = 'force-dynamic'

import { listInboxItems, getInboxRoot } from '@/lib/inbox-reader'
import InboxCard from '@/components/inbox/InboxCard'

export default async function InboxPage() {
  let items: Awaited<ReturnType<typeof listInboxItems>> = []
  let loadError = ''
  try {
    items = await listInboxItems()
  } catch (e) {
    loadError = (e as Error).message
  }
  const pending = items.filter((i) => !i.imported)
  const imported = items.filter((i) => i.imported)

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          ChatGPT Inbox
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ChatGPT が Vault に投函した ToDo メモを progress に取り込む。
          取り込みは <span className="font-mono">pending_approval</span>（ユーザー承認待ち）で登録。
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 font-mono break-all">
          読み込み元: {getInboxRoot()}
        </p>
      </header>

      {loadError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          読み込みエラー: {loadError}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          未取り込み ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            未取り込みの投函はありません。
          </p>
        ) : (
          pending.map((it) => <InboxCard key={it.file} item={it} />)
        )}
      </section>

      {imported.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            取り込み済み ({imported.length})
          </h2>
          {imported.map((it) => (
            <InboxCard key={it.file} item={it} />
          ))}
        </section>
      )}
    </div>
  )
}
