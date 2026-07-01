import { buildAutoQueue } from '@/lib/auto-queue'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { appendAutomationLog, getAutomationConfig, getPendingApprovals } from '@/lib/operations-store'
import { writeJson } from '@/lib/store'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'

export type UrgentSeverity = 'high' | 'medium'

export interface UrgentIssue {
  id: string
  severity: UrgentSeverity
  title: string
  detail: string
  actionLabel?: string
  actionHref?: string
}

interface RankedIssue extends UrgentIssue {
  rank: number
}

const JST_DAY = 24 * 60 * 60 * 1000

function parseTime(value?: string): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function jstDayNumber(time: number): number {
  return Math.floor((time + 9 * 60 * 60 * 1000) / JST_DAY)
}

function daysSince(value?: string, now = Date.now()): number {
  const time = parseTime(value)
  if (time === null) return 999
  return Math.max(0, jstDayNumber(now) - jstDayNumber(time))
}

function latestRunTime(run: ExecutionRun): number | null {
  return parseTime(run.finishedAt) ?? parseTime(run.startedAt)
}

function goalRunMatcher(goal: Goal): (run: ExecutionRun) => boolean {
  const todoIds = new Set(goal.todos.map((todo) => todo.id))
  const keys = [goal.id, goal.projectId, goal.title]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase())

  return (run) => {
    if (run.selection?.selectedGoalKey === goal.id) return true
    if (run.selection?.selectedGoalTitle === goal.title) return true
    if (run.targetTodoId && todoIds.has(run.targetTodoId)) return true
    const targetApp = run.targetApp.toLowerCase()
    return keys.some((key) => targetApp === key || targetApp.includes(key))
  }
}

function latestRunForGoal(goal: Goal, runs: ExecutionRun[]): ExecutionRun | undefined {
  const matches = runs.filter(goalRunMatcher(goal))
  return matches.sort((a, b) => (latestRunTime(b) ?? 0) - (latestRunTime(a) ?? 0))[0]
}

function hasRecentSuccessfulRun(goal: Goal, runs: ExecutionRun[], withinDays: number, now = Date.now()): boolean {
  return runs
    .filter(goalRunMatcher(goal))
    .some((run) => run.runStatus === 'completed' && daysSince(run.finishedAt || run.startedAt, now) <= withinDays)
}

function appNameFromGoal(goal: Goal): string {
  return goal.title
    .replace(/^goal[:：\s-]*/i, '')
    .replace(/を作る.*$/, '')
    .replace(/アプリを作る.*$/, 'アプリ')
    .trim() || goal.title
}

function isAppBuildGoal(goal: Goal): boolean {
  return goal.status === 'active' && (goal.id.startsWith('goal-app-') || goal.title.includes('を作る'))
}

function addIssue(list: RankedIssue[], issue: UrgentIssue, rank: number): void {
  list.push({ ...issue, rank })
}

export async function detectUrgentIssues(): Promise<UrgentIssue[]> {
  try {
    const [config, queue, runs, goalsData, pendingApprovals] = await Promise.all([
      getAutomationConfig(),
      buildAutoQueue(),
      readExecutionRuns(),
      readGoals(),
      getPendingApprovals(),
    ])
    const now = Date.now()
    const activeGoals = goalsData.goals.filter((goal) => goal.status === 'active')
    const issues: RankedIssue[] = []

    if (!config.factoryEnabled) {
      addIssue(issues, {
        id: 'factory-off',
        severity: 'high',
        title: '自動実行がOFFです',
        detail: 'Factory が停止中のため、実行可能な作業があっても自動では進みません。',
        actionLabel: '自動化設定を開く',
        actionHref: '/automation',
      }, 10)
    }

    if (queue.executable.length === 0 && activeGoals.length > 0) {
      addIssue(issues, {
        id: 'empty-auto-queue',
        severity: 'high',
        title: '実行できる作業が0件（キューが空）',
        detail: `未完了の active ゴールが ${activeGoals.length} 件ありますが、次に実行できる作業がありません。`,
        actionLabel: 'キューを確認',
        actionHref: '/queue',
      }, 20)
    }

    for (const goal of activeGoals.filter(isAppBuildGoal)) {
      const relatedRuns = runs.filter(goalRunMatcher(goal))
      const latestRun = latestRunForGoal(goal, runs)
      const latestAt = latestRun ? (latestRun.finishedAt || latestRun.startedAt) : undefined
      const baseAt = latestAt ?? goal.approvedAt ?? goal.createdAt ?? goal.updatedAt
      const stagnantDays = daysSince(baseAt, now)
      const progress = goalAchievement(goal)
      const noRecentSuccess = !hasRecentSuccessfulRun(goal, relatedRuns, 3, now)
      const latestFailed = latestRun?.runStatus === 'failed'
      const zeroProgress = progress === 0

      if (noRecentSuccess || latestFailed || zeroProgress) {
        const reasons = [
          noRecentSuccess ? '直近3日以内の成功Runがありません' : '',
          latestFailed ? '最新Runが失敗しています' : '',
          zeroProgress ? '進捗が0%のままです' : '',
        ].filter(Boolean)
        addIssue(issues, {
          id: `app-stalled-${goal.id}`,
          severity: 'high',
          title: `『${appNameFromGoal(goal)}』が作成対象なのに${stagnantDays}日進んでいません`,
          detail: reasons.join('。') + `。現在の進捗は ${progress}% です。`,
          actionLabel: 'ゴールを確認',
          actionHref: `/goal-planner?goalId=${encodeURIComponent(goal.id)}`,
        }, 30 + stagnantDays)
      }
    }

    const unreviewedFailed = runs.filter((run) =>
      run.runStatus === 'failed' && (run.reviewStatus === 'not_reviewed' || run.reviewStatus === 'needs_followup')
    )
    if (unreviewedFailed.length > 0) {
      addIssue(issues, {
        id: 'failed-runs-unreviewed',
        severity: 'high',
        title: `失敗した作業が${unreviewedFailed.length}件、未対応です`,
        detail: '失敗Runのレビューまたは修正依頼が残っています。',
        actionLabel: 'レビューを確認',
        actionHref: '/decide?tab=reviews',
      }, 40 + unreviewedFailed.length)
    }

    if (queue.blocked.length >= 1) {
      addIssue(issues, {
        id: 'blocked-work-items',
        severity: 'medium',
        title: `ブロック中の作業が${queue.blocked.length}件`,
        detail: 'ブロック理由を解消すると、自動実行キューに戻せる可能性があります。',
        actionLabel: 'キューを確認',
        actionHref: '/queue',
      }, 60 + queue.blocked.length)
    }

    if (pendingApprovals.length >= 5) {
      addIssue(issues, {
        id: 'pending-approvals',
        severity: 'medium',
        title: `今日の判断が${pendingApprovals.length}件たまっています`,
        detail: '承認待ちが多く、次の自動実行や方針決定が詰まりやすい状態です。',
        actionLabel: '今日の判断',
        actionHref: '/decide?tab=today',
      }, 70 + pendingApprovals.length)
    }

    const staleGoals = activeGoals.filter((goal) => {
      const latestRun = latestRunForGoal(goal, runs)
      const latestRunAt = latestRun ? latestRunTime(latestRun) : null
      const updatedAt = parseTime(goal.updatedAt)
      const lastActivity = Math.max(updatedAt ?? 0, latestRunAt ?? 0)
      return lastActivity > 0 && daysSince(new Date(lastActivity).toISOString(), now) >= 7
    })
    if (staleGoals.length > 0) {
      addIssue(issues, {
        id: 'stale-goals',
        severity: 'medium',
        title: `${staleGoals.length}件のゴールが1週間以上停滞`,
        detail: 'ゴール更新または関連Runから7日以上動きがありません。',
        actionLabel: 'ゴールを確認',
        actionHref: '/goal-planner',
      }, 80 + staleGoals.length)
    }

    return issues
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1
        if (a.rank !== b.rank) return a.rank - b.rank
        return a.title.localeCompare(b.title)
      })
      .slice(0, 10)
      .map(({ rank: _rank, ...issue }) => issue)
  } catch (err) {
    console.warn('detectUrgentIssues failed:', err)
    return []
  }
}

export async function recordUrgentIssues(): Promise<{ count: number }> {
  const issues = await detectUrgentIssues()
  await writeJson('urgent-issues.json', {
    generatedAt: new Date().toISOString(),
    issues,
  })
  await appendAutomationLog({
    event: 'urgent_issues_recorded',
    fallbackReason: `count=${issues.length} ${issues.slice(0, 5).map((issue) => issue.title).join(', ')}`,
  })
  return { count: issues.length }
}
