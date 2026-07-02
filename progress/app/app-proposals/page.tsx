import AppProposalCard from '@/components/app-proposals/AppProposalCard'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals, type AppProposal, type AppProposalPipelineStatus } from '@/lib/app-proposals'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import { buildAutoQueue } from '@/lib/auto-queue'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { getEpics } from '@/lib/operations-store'
import type { Goal } from '@/types/goal'

export const dynamic = 'force-dynamic'

export default async function AppProposalsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const proposals = await attachPipelineStatuses(await getAppProposals())
  const isDecided = (d: (typeof proposals)[number]['decision']) => d === 'approved' || d === 'rejected' || d === 'not_needed'
  // 承認待ち = 未判断 + 保留。決定済み(作成中/却下/作成不要) は初期表示に出さず別タブへ。
  const pendingProposals = proposals.filter((p) => !isDecided(p.decision))
  const decidedProposals = proposals.filter((p) => isDecided(p.decision))
  const viewParam = Array.isArray(searchParams?.view) ? searchParams?.view[0] : searchParams?.view
  const view: 'pending' | 'decided' = viewParam === 'decided' ? 'decided' : 'pending'
  const counts = {
    undecided: proposals.filter((proposal) => !proposal.decision).length,
    approved: proposals.filter((proposal) => proposal.decision === 'approved').length,
    notNeeded: proposals.filter((proposal) => proposal.decision === 'not_needed').length,
    rejected: proposals.filter((proposal) => proposal.decision === 'rejected').length,
    held: proposals.filter((proposal) => proposal.decision === 'held').length,
  }
  const shown = (view === 'decided' ? decidedProposals : pendingProposals).slice().sort((a, b) => {
    const order = (decision: typeof a.decision) => (!decision ? 0 : decision === 'held' ? 1 : 2)
    return order(a.decision) - order(b.decision) || a.name.localeCompare(b.name, 'ja')
  })
  const viewTabs: Array<{ key: 'pending' | 'decided'; label: string; count: number; href: string }> = [
    { key: 'pending', label: '承認待ち', count: pendingProposals.length, href: '/app-proposals' },
    { key: 'decided', label: '決定済み・作成中', count: decidedProposals.length, href: '/app-proposals?view=decided' },
  ]

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="アプリ概要承認"
        guide="アプリ案の概要と画面イメージ(モック)を確認して、承認・却下・保留を選びます。承認すると詳細仕様のゴール承認に進みます。決定済み・作成中は「決定済み・作成中」タブにまとまります。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />
      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">アプリ案</p>
        <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{proposals.length}件</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <StatusChip label="未判断" count={counts.undecided} tone="gray" />
          <StatusChip label="承認" count={counts.approved} tone="green" />
          <StatusChip label="作成不要" count={counts.notNeeded} tone="blue" />
          <StatusChip label="却下" count={counts.rejected} tone="rose" />
          <StatusChip label="保留" count={counts.held} tone="amber" />
        </div>
      </section>
      <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {viewTabs.map((tab) => (
          <a
            key={tab.key}
            href={tab.href}
            className={`-mb-px border-b-2 px-3 py-2.5 text-sm font-bold ${
              view === tab.key
                ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab.label} {tab.count}
          </a>
        ))}
      </nav>
      <section className="space-y-4">
        {shown.length > 0 ? (
          shown.map((proposal) => <AppProposalCard key={proposal.id} proposal={proposal} />)
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            {view === 'decided' ? '決定済み・作成中のアプリ案はありません。' : '承認待ちのアプリ案はありません。'}
          </p>
        )}
      </section>
    </main>
  )
}

async function attachPipelineStatuses(proposals: AppProposal[]): Promise<AppProposal[]> {
  const approved = proposals.filter((proposal) => proposal.decision === 'approved' && proposal.projectId)
  if (approved.length === 0) return proposals

  const [goalsData, queue, epics] = await Promise.all([
    readGoals(),
    buildAutoQueue(),
    getEpics(),
  ])
  const goalProgressById = new Map(queue.goalProgress.map((row) => [row.goalId, row]))
  const executableGoalIds = new Set(queue.executable.map((item) => item.goalId).filter((goalId): goalId is string => Boolean(goalId)))
  const blockedGoalIds = new Set(queue.blocked.map((item) => item.goalId).filter((goalId): goalId is string => Boolean(goalId)))

  return proposals.map((proposal) => {
    if (proposal.decision !== 'approved' || !proposal.projectId) return proposal
    return {
      ...proposal,
      pipelineStatus: derivePipelineStatus(proposal.projectId, goalsData.goals, {
        goalProgressById,
        executableGoalIds,
        blockedGoalIds,
        epics,
      }),
    }
  })
}

function findAppGoal(projectId: string, goals: Goal[]): Goal | undefined {
  return goals.find((goal) => goal.id === `goal-app-${projectId}`)
    ?? goals.find((goal) => goal.projectId === projectId && goal.status === 'active')
    ?? goals.find((goal) => goal.projectId === projectId)
}

function derivePipelineStatus(
  projectId: string,
  goals: Goal[],
  context: {
    goalProgressById: Map<string, { executable: number; blocked: number; done: number; total: number; ratio: number }>
    executableGoalIds: Set<string>
    blockedGoalIds: Set<string>
    epics: Awaited<ReturnType<typeof getEpics>>
  },
): AppProposalPipelineStatus | undefined {
  const goal = findAppGoal(projectId, goals)
  if (!goal) return undefined

  const row = context.goalProgressById.get(goal.id)
  const goalEpics = context.epics.filter((epic) => epic.goalId === goal.id)
  const hasBlocked = context.blockedGoalIds.has(goal.id)
    || (row?.blocked ?? 0) > 0
    || goalEpics.some((epic) => epic.status === 'blocked' || (epic.blockers ?? []).length > 0)
  const hasInProgress = goalEpics.some((epic) => (
    epic.status === 'active'
    || epic.status === 'in_review'
    || epic.status === 'done'
    || epic.status === 'merged'
    || Boolean(epic.latestRunId)
    || epic.progress > 0
  )) || goal.todos.some((todo) => String(todo.status) === 'active' || String(todo.status) === 'in_progress' || todo.status === 'done')
  const hasQueued = context.executableGoalIds.has(goal.id) || (row?.executable ?? 0) > 0
  const isHeld = goal.queueControl?.hold === true

  if (goal.status === 'done' || goalAchievement(goal) >= 100) return 'completed'
  if (hasBlocked) return 'blocked'
  if (hasInProgress) return 'in_progress'
  if (isHeld) return 'held'
  if (hasQueued) return 'queued'
  return undefined
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
