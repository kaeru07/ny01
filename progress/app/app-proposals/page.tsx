import AppProposalCard from '@/components/app-proposals/AppProposalCard'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals } from '@/lib/app-proposals'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'

export const dynamic = 'force-dynamic'

export default async function AppProposalsPage() {
  const proposals = await getAppProposals()
  const counts = {
    undecided: proposals.filter((proposal) => !proposal.decision).length,
    approved: proposals.filter((proposal) => proposal.decision === 'approved').length,
    notNeeded: proposals.filter((proposal) => proposal.decision === 'not_needed').length,
    rejected: proposals.filter((proposal) => proposal.decision === 'rejected').length,
    held: proposals.filter((proposal) => proposal.decision === 'held').length,
  }
  const sortedProposals = proposals.slice().sort((a, b) => {
    const order = (decision: typeof a.decision) => {
      if (!decision) return 0
      if (decision === 'held') return 1
      return 2
    }
    return order(a.decision) - order(b.decision) || a.name.localeCompare(b.name, 'ja')
  })

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="アプリ概要承認"
        guide="アプリ案の概要と画面イメージ(モック)を確認して、承認・却下・保留を選びます。承認すると詳細仕様のゴール承認に進みます。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">承認待ちアプリ案</p>
        <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{proposals.length}件</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <StatusChip label="未判断" count={counts.undecided} tone="gray" />
          <StatusChip label="承認" count={counts.approved} tone="green" />
          <StatusChip label="作成不要" count={counts.notNeeded} tone="blue" />
          <StatusChip label="却下" count={counts.rejected} tone="rose" />
          <StatusChip label="保留" count={counts.held} tone="amber" />
        </div>
      </section>
      <section className="space-y-4">
        {proposals.length > 0 ? (
          sortedProposals.map((proposal) => <AppProposalCard key={proposal.id} proposal={proposal} />)
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            承認対象のアプリ案はありません。
          </p>
        )}
      </section>
    </main>
  )
}

function StatusChip({ label, count, tone }: { label: string; count: number; tone: 'gray' | 'green' | 'blue' | 'rose' | 'amber' }) {
  const toneClass = {
    gray: 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200',
    green: 'border-green-200 bg-green-50 text-green-700 dark:border-green-900/60 dark:bg-green-900/20 dark:text-green-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-900/20 dark:text-blue-200',
    rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-900/20 dark:text-rose-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200',
  }[tone]

  return (
    <span className={`min-h-8 shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${toneClass}`}>
      {label} {count}
    </span>
  )
}
