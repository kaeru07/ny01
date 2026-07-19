import { NextResponse } from 'next/server'
import {
  formatJstShortDateTime,
  formatUnshippedCommitLines,
  getIosBuildsOverview,
} from '@/lib/ios-builds'
import { createApproval, getPendingApprovals, updatePendingApproval } from '@/lib/operations-store'
import type { Approval } from '@/lib/types/operations'
import type { IosBuildsAppResponse, IosCodemagicBuild } from '@/types/ios-builds'

export const dynamic = 'force-dynamic'

const BUILD_OPTION_DETAIL = 'Codemagicで自動ビルドしTestFlightへアップロードします（約3〜5分）。完了後iPhoneのTestFlightアプリで更新できます。'
const SKIP_OPTION_DETAIL = '今回はビルドしません。変更が増えれば次回また候補に挙がります。'

function statusKey(status: string | null): string {
  return (status ?? '').toLowerCase()
}

function isSuccessStatus(status: string | null): boolean {
  return ['finished', 'success', 'successful', 'passed'].includes(statusKey(status))
}

function latestSuccessfulBuild(builds: IosCodemagicBuild[]): IosCodemagicBuild | null {
  return builds.find((build) => isSuccessStatus(build.status)) ?? null
}

function latestBuildFinishedAt(app: IosBuildsAppResponse): string | null {
  return app.builds[0]?.finishedAt ?? app.builds[0]?.startedAt ?? null
}

function quotedName(app: IosBuildsAppResponse): string {
  return `「${app.appName}」`
}

function approvalTitle(app: IosBuildsAppResponse): string {
  if (app.candidate.reason === '未ビルド') {
    return `iOSビルド候補: ${quotedName(app)}はまだ一度もTestFlight配信されていません。初回ビルドしますか？`
  }
  if (app.candidate.reason === '最新ビルド失敗') {
    return `iOSビルド候補: ${quotedName(app)}は前回のビルドが失敗したままです。再ビルドしますか？`
  }
  if (app.candidate.reason === '未反映コミットあり') {
    return `iOSビルド候補: ${quotedName(app)}に未配信の変更があります。ビルドしますか？`
  }
  return `iOSビルド候補: ${quotedName(app)}をビルドしますか？`
}

function shortReason(app: IosBuildsAppResponse): string {
  const latestSuccess = latestSuccessfulBuild(app.builds)
  const deliveredAt = formatJstShortDateTime(app.unshippedCommits?.baseFinishedAt ?? latestSuccess?.finishedAt)
  const latestFinishedAt = formatJstShortDateTime(latestBuildFinishedAt(app))
  const changeCount = app.unshippedCommits?.total ?? 0

  if (app.candidate.reason === '未ビルド') {
    return `${quotedName(app)}はまだTestFlightへ配信されたビルドがありません。iPhoneで初回確認できる状態にするか決めてください。`
  }
  if (app.candidate.reason === '最新ビルド失敗') {
    return latestFinishedAt
      ? `前回のiOSビルド（${latestFinishedAt}）は失敗したままです。修正済みなら再ビルドしてTestFlightへ届けられます。`
      : '前回のiOSビルドは失敗したままです。修正済みなら再ビルドしてTestFlightへ届けられます。'
  }
  if (app.candidate.reason === '未反映コミットあり') {
    if (deliveredAt && changeCount > 0) {
      return `前回のTestFlight配信（${deliveredAt}）のあとに新しい変更が${changeCount}件あり、まだiPhoneで試せる状態になっていません。`
    }
    if (deliveredAt) {
      return `前回のTestFlight配信（${deliveredAt}）のあとにローカルの新しい変更があり、まだiPhoneで試せる状態になっていません。`
    }
    return 'ローカルの新しい変更が、まだTestFlightで試せる状態になっていません。'
  }
  return 'iOSビルド候補があります。必要ならTestFlightへ配信してください。'
}

function detailLines(app: IosBuildsAppResponse): string[] {
  const lines: string[] = []
  const unshippedLines = formatUnshippedCommitLines(app.unshippedCommits)
  const latestSuccess = latestSuccessfulBuild(app.builds)
  const lastDelivery = formatJstShortDateTime(app.unshippedCommits?.baseFinishedAt ?? latestSuccess?.finishedAt)
  const latestFinished = formatJstShortDateTime(latestBuildFinishedAt(app))

  if (app.candidate.reason === '未反映コミットあり') {
    lines.push('配信されていない変更:')
    if (unshippedLines.length > 0) {
      lines.push(...unshippedLines)
    } else {
      lines.push('- 変更内容は取得できませんでした。ローカル最新コミットが前回配信より新しい可能性があります。')
    }
  }

  lines.push('最後の配信:')
  if (lastDelivery) {
    lines.push(`- ${lastDelivery} に成功したビルドです。`)
    if (app.unshippedCommits?.baseSubject) {
      lines.push(`- その時の変更: 『${app.unshippedCommits.baseSubject}』`)
    }
  } else if (app.candidate.reason === '未ビルド') {
    lines.push('- まだTestFlightへ配信されたビルドはありません。')
  } else if (latestFinished) {
    lines.push(`- 前回ビルドは ${latestFinished} に終わりましたが、成功していません。`)
  } else {
    lines.push('- 直近の成功配信は確認できませんでした。')
  }

  lines.push('ビルドの中身:')
  lines.push('- CodemagicでiOS App Store向けにビルドし、成功するとTestFlightへ自動アップロードされます。')
  lines.push('- 完了後、iPhoneのTestFlightアプリで更新を確認できます。')
  return lines
}

function approvalReason(app: IosBuildsAppResponse): string {
  return [
    shortReason(app),
    '',
    ...detailLines(app),
  ].join('\n')
}

function findExistingApproval(approvals: Approval[], app: IosBuildsAppResponse): Approval | undefined {
  return approvals.find((approval) => (
    approval.category === 'multi_option' &&
    approval.projectId === app.dir &&
    approval.title.startsWith('iOSビルド候補')
  ))
}

export async function POST() {
  const [overview, pendingApprovals] = await Promise.all([
    getIosBuildsOverview(),
    getPendingApprovals(),
  ])
  const created: Array<{ dir: string; title: string; approvalId: string }> = []
  const updated: Array<{ dir: string; title: string; approvalId: string }> = []
  const skipped: Array<{ dir: string; title: string; reason: string }> = []

  for (const app of overview.apps.filter((item) => item.candidate.isCandidate)) {
    const title = approvalTitle(app)
    const options = [
      { key: 'build', label: 'ビルドする', detail: BUILD_OPTION_DETAIL },
      { key: 'skip', label: '見送る', detail: SKIP_OPTION_DETAIL },
    ]
    const existing = findExistingApproval(pendingApprovals, app)
    if (existing) {
      const approval = await updatePendingApproval(existing.approvalId, {
        title,
        options,
        recommended: 'build',
        reason: approvalReason(app),
        requiredForExecution: false,
      })
      if (approval) {
        updated.push({ dir: app.dir, title: approval.title, approvalId: approval.approvalId })
      } else {
        skipped.push({ dir: app.dir, title, reason: '既存approvalの更新に失敗しました' })
      }
      continue
    }

    const approval = await createApproval({
      projectId: app.dir,
      title,
      category: 'multi_option',
      priority: 'normal',
      options,
      recommended: 'build',
      reason: approvalReason(app),
    })
    pendingApprovals.push(approval)
    created.push({ dir: app.dir, title, approvalId: approval.approvalId })
  }

  return NextResponse.json({ success: true, created, updated, skipped })
}
