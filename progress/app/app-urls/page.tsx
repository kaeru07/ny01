export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppUrls, enrichAppUrls } from '@/lib/app-urls'
import { AppUrlsBoard } from '@/components/app-urls/AppUrlsBoard'

export default async function AppUrlsPage() {
  const registry = await readAppUrls()
  const apps = enrichAppUrls(registry)

  const okCount = apps.filter((a) => a.iphoneAccess === 'ok').length
  const blockedCount = apps.filter((a) => a.iphoneAccess === 'blocked').length
  const unknownCount = apps.filter((a) => a.iphoneAccess === 'unknown').length

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">アプリURL</h1>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              iPhoneで確認するためのURL一覧 / {apps.length} 件（📱見れる {okCount} / 🚫直接不可 {blockedCount} / ❔未確認 {unknownCount}）
            </p>
          </div>
          <Link href="/epic/epic-progress-url" className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            Epic
          </Link>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
          この一覧は <strong>iPhone Safari / iPhoneアプリから動作確認するためのURL一覧</strong>です。localhost / 127.0.0.1 / 内部ポート / SSHポートフォワード前提のURLはiPhoneから直接開けないため「iPhone直接不可」として補助情報に折りたたんでいます。iPhoneで押せるURL（Vercel / 公開VPS / HTTPS公開）だけを確認用URLとして上部に表示します。
          {registry.operationMemo && <span className="mt-2 block text-blue-800/80 dark:text-blue-200/80">{registry.operationMemo}</span>}
        </div>
      </header>

      {apps.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          URL台帳はまだありません。
        </p>
      ) : (
        <AppUrlsBoard apps={apps} />
      )}
    </div>
  )
}
