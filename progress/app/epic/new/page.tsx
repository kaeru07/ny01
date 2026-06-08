'use client'

import { useState } from 'react'
import Link from 'next/link'
import EpicCreateForm from '@/components/epic/EpicCreateForm'
import EpicJsonImport from '@/components/epic/EpicJsonImport'
import EpicTemplateCopyButton from '@/components/epic/EpicTemplateCopyButton'

type Tab = 'form' | 'import'

export default function NewEpicPage() {
  const [tab, setTab] = useState<Tab>('form')

  return (
    <div className="space-y-4 px-4 pb-8 pt-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Link href="/epic" className="hover:underline">工場</Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-500">Epic 作成</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Epic を作成（契約形式）</h1>
        <p className="text-sm text-gray-400">title / goal / doneCriteria / decisionPolicy / priority / riskFlags を明示します。完了条件と安全条件を満たした Epic だけ Factory/Auto Resume の自動実行対象になります。</p>
      </header>

      {/* テンプレコピー（ChatGPT/Claude/Codex で埋めてもらう） */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">JSONテンプレをコピー</h2>
        <p className="mb-3 text-[11px] text-gray-400">AI に渡して埋めてもらい、下の「JSONインポート」で取り込めます。</p>
        <EpicTemplateCopyButton />
      </section>

      {/* タブ: フォーム入力 / JSONインポート */}
      <div className="flex gap-2">
        <button onClick={() => setTab('form')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>フォーム入力</button>
        <button onClick={() => setTab('import')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'import' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>JSONインポート</button>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {tab === 'form' ? <EpicCreateForm /> : <EpicJsonImport />}
      </section>
    </div>
  )
}
