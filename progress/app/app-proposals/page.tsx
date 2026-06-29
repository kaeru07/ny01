import AppProposalCard from '@/components/app-proposals/AppProposalCard'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals } from '@/lib/app-proposals'

export const dynamic = 'force-dynamic'

export default async function AppProposalsPage() {
  const proposals = await getAppProposals()

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="アプリ概要承認"
        guide="アプリ案の概要と画面イメージ(モック)を確認して、承認・却下・保留を選びます。承認すると詳細仕様のゴール承認に進みます。"
      />
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">承認待ちアプリ案</p>
        <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{proposals.length}件</p>
      </section>
      <section className="space-y-4">
        {proposals.length > 0 ? (
          proposals.map((proposal) => <AppProposalCard key={proposal.id} proposal={proposal} />)
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            承認対象のアプリ案はありません。
          </p>
        )}
      </section>
    </main>
  )
}
