import AppSpecDecisionCard from '@/components/app-proposals/AppSpecDecisionCard'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals } from '@/lib/app-proposals'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import { getApprovals, getOperationalDecisions } from '@/lib/operations-store'

export const dynamic = 'force-dynamic'

interface DecisionRow {
  id: string
  time: string
  target: string
  kind: string
  decision: string
  note?: string
}

const EXISTING_STATUSES = new Set([
  'ready_to_ship',
  'deploy_ready',
  'in_progress',
  'confirmed',
  'active',
  'user_action_pending',
])

function timeOf(value?: string): number {
  const time = Date.parse(value ?? '')
  return Number.isNaN(time) ? 0 : time
}

function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  })
}

function kindLabel(type?: string): string {
  if (type === 'app_proposal') return '承認'
  if (type === 'app_spec') return '仕様承認'
  return '方針決定'
}

export default async function AppSpecsPage() {
  const [apps, decisions, approvals] = await Promise.all([getAppProposals(), getOperationalDecisions(), getApprovals()])
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
  const appNameById = new Map(apps.map((app) => [app.id, app.name]))
  const appNameByProjectId = new Map(apps.map((app) => [app.projectId, app.name]).filter((entry): entry is [string, string] => Boolean(entry[0])))

  const decisionRows: DecisionRow[] = decisions
    .filter((entry) => entry.type === 'app_proposal' || entry.type === 'app_spec')
    .map((entry) => ({
      id: entry.decisionId,
      time: entry.decidedAt ?? entry.time ?? '',
      target: (entry.targetId && appNameById.get(entry.targetId)) || entry.targetId || entry.topic,
      kind: kindLabel(entry.type),
      decision: entry.decision,
      note: entry.note,
    }))

  const approvalRows: DecisionRow[] = approvals
    .filter((approval) => approval.status !== 'pending' && approval.projectId)
    .map((approval) => ({
      id: approval.approvalId,
      time: approval.decidedAt ?? approval.createdAt,
      target: (approval.projectId && appNameByProjectId.get(approval.projectId)) || approval.projectId || approval.title,
      kind: '方針決定',
      decision: approval.decidedOption ?? approval.status,
      note: approval.title,
    }))

  const rows = [...decisionRows, ...approvalRows].sort((a, b) => timeOf(b.time) - timeOf(a.time))

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="仕様承認・履歴"
        guide="既に動いている、または開発中のアプリの画面・機能仕様承認と、アプリ承認・方針決定の履歴を確認します。"
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

      <section className="space-y-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">承認・方針決定歴</p>
          <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{rows.length}件</p>
        </div>

        <div className="space-y-2">
          {rows.length > 0 ? (
            rows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{formatDateTime(row.time)}</p>
                    <h2 className="mt-0.5 text-sm font-black text-gray-900 dark:text-gray-100">{row.target}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                    {row.kind}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-gray-700 dark:text-gray-200">決定: {row.decision}</p>
                {row.note ? <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">{row.note}</p> : null}
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              アプリ承認・方針決定の履歴はまだありません。
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
