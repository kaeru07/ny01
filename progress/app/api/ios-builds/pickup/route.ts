import { NextResponse } from 'next/server'
import { getIosBuildsOverview } from '@/lib/ios-builds'
import { createApproval, getPendingApprovals } from '@/lib/operations-store'
import type { IosBuildsAppResponse, IosCodemagicBuild } from '@/types/ios-builds'

export const dynamic = 'force-dynamic'

function latestBuildSummary(builds: IosCodemagicBuild[]): string {
  const latest = builds[0]
  if (!latest) return '直近ビルド: なし'
  return [
    `直近ビルド: ${latest.status ?? 'unknown'}`,
    latest.workflowId ? `workflow=${latest.workflowId}` : null,
    latest.branch ? `branch=${latest.branch}` : null,
    latest.finishedAt ? `finishedAt=${latest.finishedAt}` : null,
    latest.commitHash ? `commit=${latest.commitHash}` : null,
  ].filter(Boolean).join(' / ')
}

function approvalReason(app: IosBuildsAppResponse): string {
  return [
    `reason: ${app.candidate.reason ?? '候補'}`,
    latestBuildSummary(app.builds),
    app.localGit.head ? `local HEAD: ${app.localGit.head}` : 'local HEAD: unknown',
    app.localGit.lastCommitAt ? `local commit at: ${app.localGit.lastCommitAt}` : null,
    app.bundleId ? `bundleId: ${app.bundleId}` : null,
  ].filter(Boolean).join('\n')
}

export async function POST() {
  const [overview, pendingApprovals] = await Promise.all([
    getIosBuildsOverview(),
    getPendingApprovals(),
  ])
  const pendingTitles = new Set(pendingApprovals.map((approval) => approval.title))
  const created: Array<{ dir: string; title: string; approvalId: string }> = []
  const skipped: Array<{ dir: string; title: string; reason: string }> = []

  for (const app of overview.apps.filter((item) => item.candidate.isCandidate)) {
    const title = `iOSビルド候補: ${app.appName}`
    if (pendingTitles.has(title)) {
      skipped.push({ dir: app.dir, title, reason: '同一タイトルの未決 approval が既にあります' })
      continue
    }

    const approval = await createApproval({
      projectId: app.dir,
      title,
      category: 'multi_option',
      priority: 'normal',
      options: [
        { key: 'build', label: 'ビルドする', detail: 'CodemagicでTestFlight向けビルドを起動する' },
        { key: 'skip', label: '見送る', detail: '今日はビルドしない' },
      ],
      recommended: 'build',
      reason: approvalReason(app),
    })
    pendingTitles.add(title)
    created.push({ dir: app.dir, title, approvalId: approval.approvalId })
  }

  return NextResponse.json({ success: true, created, skipped })
}
