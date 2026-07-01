import AppSpecDecisionCard from '@/components/app-proposals/AppSpecDecisionCard'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals } from '@/lib/app-proposals'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import { getOperationalDecisions } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

const EXISTING_STATUSES = new Set([
  'ready_to_ship',
  'deploy_ready',
  'in_progress',
  'confirmed',
  'active',
  'user_action_pending',
])

export default async function AppSpecsPage() {
  const [apps, decisions] = await Promise.all([getAppProposals(), getOperationalDecisions()])
  const latestSpecDecision = new Map<string, { action?: string; decision: string; note?: string }>()

  for (const entry of decisions) {
    if (entry.type !== 'app_spec' || !entry.targetId) continue
    latestSpecDecision.set(entry.targetId, {
      action: entry.action,
      decision: entry.decision,
      note: entry.note,
    })
  }

  const existingApps = apps
    .filter((app) => app.projectId && (app.decision || EXISTING_STATUSES.has(app.status)))
    .sort((a, b) => {
      const aDecided = latestSpecDecision.has(a.id) ? 1 : 0
      const bDecided = latestSpecDecision.has(b.id) ? 1 : 0
      return aDecided - bDecided || a.name.localeCompare(b.name, 'ja')
    })

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="既存アプリ仕様承認"
        guide="既に動いている、または開発中のアプリの画面・機能仕様を確認して、承認または保留を記録します。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />

      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">仕様確認対象</p>
        <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{existingApps.length}件</p>
      </section>

      <section className="space-y-4">
        {existingApps.length > 0 ? (
          existingApps.map((app) => (
            <AppSpecDecisionCard key={app.id} app={app} latestDecision={latestSpecDecision.get(app.id)} />
          ))
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            仕様承認の対象になる既存アプリはありません。
          </p>
        )}
      </section>
    </main>
  )
}
