import Link from 'next/link'
import SubTabBar from '@/components/navigation/SubTabBar'
import PageGuide from '@/components/newux/PageGuide'
import { getAppProposals, type AppProposal, type AppProposalPipelineStatus } from '@/lib/app-proposals'
import { attachPipelineStatuses } from '@/lib/app-pipeline-status'
import { APP_DEVELOPMENT_SUBTABS } from '@/lib/nav-groups'
import { getApprovals } from '@/lib/operations-store'
import type { Approval } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

const pipelineStatusBadge: Record<AppProposalPipelineStatus, { label: string; className: string }> = {
  queued: {
    label: 'キュー投入済み',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  },
  held: {
    label: '必須判断待ち',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
  },
  in_progress: {
    label: '作成中',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
  blocked: {
    label: '停止中',
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200',
  },
  completed: {
    label: '完成',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  },
}

const difficultyLabel = {
  low: '低',
  medium: '中',
  high: '高',
} as const

function approvalMatchesApp(approval: Approval, app: AppProposal): boolean {
  if (app.projectId && approval.projectId === app.projectId) return true
  return approval.title.startsWith(`${app.name}: `)
}

function approvalOptionLabel(approval: Approval): string {
  if (!approval.decidedOption) return approval.status
  return approval.options.find((option) => option.key === approval.decidedOption)?.label ?? approval.decidedOption
}

function decideHref(projectId: string | null): string {
  return projectId ? `/decide?tab=today&projectId=${encodeURIComponent(projectId)}` : '/decide?tab=today'
}

function isNonEmptyArray<T>(value: T[] | undefined): value is T[] {
  return Array.isArray(value) && value.length > 0
}

function SpecSection({ app }: { app: AppProposal }) {
  const rows: Array<{ label: string; value: string | string[]; multiline?: boolean }> = []
  if (app.spec) rows.push({ label: '仕様', value: app.spec, multiline: true })
  if (app.mvpScope) rows.push({ label: 'MVP範囲', value: app.mvpScope, multiline: true })
  if (app.difficulty) rows.push({ label: '難易度', value: difficultyLabel[app.difficulty] })
  if (isNonEmptyArray(app.externalApis)) rows.push({ label: '外部API', value: app.externalApis })
  if (app.initialGoalDraft) rows.push({ label: '初期ゴール案', value: app.initialGoalDraft, multiline: true })

  if (rows.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">仕様</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
            <p className="text-[11px] font-black text-gray-500 dark:text-gray-400">{row.label}</p>
            {Array.isArray(row.value) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.value.map((item) => (
                  <span key={item} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-gray-700 dark:bg-gray-950 dark:text-gray-200">
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className={`mt-1 text-xs leading-relaxed text-gray-700 dark:text-gray-200 ${row.multiline ? 'whitespace-pre-line' : ''}`}>
                {row.value}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function ScreensSection({ app }: { app: AppProposal }) {
  if (app.screens.length === 0) return null

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">画面</h3>
      <div className="space-y-2">
        {app.screens.map((screen) => (
          <details key={screen.key} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
            <summary className="cursor-pointer text-xs font-black text-gray-900 dark:text-gray-100">
              {screen.name}
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {screen.rows.map((row) => (
                <li key={row} className="text-[11px] font-semibold leading-relaxed text-gray-600 dark:text-gray-300">
                  {row}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  )
}

function DecidedApprovalsSection({ approvals }: { approvals: Approval[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">決定済み方針</h3>
      {approvals.length > 0 ? (
        <ul className="space-y-2">
          {approvals.map((approval) => (
            <li key={approval.approvalId} className="rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
              <p className="text-xs font-bold leading-relaxed text-gray-900 dark:text-gray-100">{approval.title}</p>
              <p className="mt-1 text-[11px] font-semibold text-green-800 dark:text-green-200">選択: {approvalOptionLabel(approval)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">決定済み方針はまだありません。</p>
      )}
    </section>
  )
}

function PendingApprovalsSection({ approvals, projectId }: { approvals: Approval[]; projectId: string | null }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-black text-gray-900 dark:text-gray-100">未回答方針</h3>
      {approvals.length > 0 ? (
        <ul className="space-y-2">
          {approvals.map((approval) => (
            <li key={approval.approvalId} className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-bold leading-relaxed text-gray-900 dark:text-gray-100">{approval.title}（未回答）</p>
                {approval.requiredForExecution ? (
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">必須</span>
                ) : null}
              </div>
              <Link
                href={decideHref(projectId)}
                className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-amber-600 px-3 text-[11px] font-black text-white dark:bg-amber-500"
              >
                今日の判断で回答
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">未回答方針はありません。</p>
      )}
    </section>
  )
}

export default async function AppDesignsPage() {
  const [rawProposals, approvals] = await Promise.all([getAppProposals(), getApprovals()])
  const proposals = await attachPipelineStatuses(rawProposals)
  const apps = proposals
    .filter((proposal) => proposal.decision === 'approved')
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="設計一覧"
        guide="作成決定したアプリの仕様・画面・決めた方針・まだ決めていない方針を1画面で確認できます。"
      />
      <SubTabBar items={APP_DEVELOPMENT_SUBTABS} />

      <section className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-950">
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">作成決定済みアプリ</p>
        <p className="mt-1 text-2xl font-black text-gray-900 dark:text-gray-100">{apps.length}件</p>
      </section>

      <section className="space-y-4">
        {apps.length > 0 ? (
          apps.map((app) => {
            const pipelineBadge = app.pipelineStatus ? pipelineStatusBadge[app.pipelineStatus] : null
            const riskFlags = app.riskFlags ?? []
            const appApprovals = approvals.filter((approval) => approvalMatchesApp(approval, app))
            const decidedApprovals = appApprovals.filter((approval) => approval.status === 'decided' && approval.decidedOption !== 'auto_closed')
            const pendingApprovals = app.projectId
              ? approvals.filter((approval) => approval.status === 'pending' && approval.projectId === app.projectId)
              : []

            return (
              <article key={app.id} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{app.projectId ?? '未分類'}</p>
                    <h2 className="text-base font-black text-gray-900 dark:text-gray-100">{app.name}</h2>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {pipelineBadge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${pipelineBadge.className}`}>{pipelineBadge.label}</span> : null}
                    {riskFlags.length > 0 ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-900/30 dark:text-red-200">⚠危険</span>
                    ) : null}
                  </div>
                </div>

                <SpecSection app={app} />
                <ScreensSection app={app} />
                <DecidedApprovalsSection approvals={decidedApprovals} />
                <PendingApprovalsSection approvals={pendingApprovals} projectId={app.projectId} />
              </article>
            )
          })
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
            <p>作成決定済みのアプリはまだありません。アプリ案を承認すると、ここに設計が集約されます。</p>
            <Link href="/app-proposals" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white dark:bg-blue-500">
              アプリ案を見る
            </Link>
          </div>
        )}
      </section>
    </main>
  )
}
