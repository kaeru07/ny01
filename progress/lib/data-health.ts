import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getEpics } from '@/lib/operations-store'
import { readGoals } from '@/lib/goal-reader'

export type DataHealthIssueKind = 'orphan_epic_ref' | 'missing_goal_ref' | 'stale_followup' | 'stale_running' | 'goals_read_error'

export interface DataHealthIssue {
  kind: DataHealthIssueKind
  message: string
  ref: string
}

export interface DataHealthSummary {
  ok: boolean
  issues: DataHealthIssue[]
  warningText: string | null
}

const FOLLOWUP_STALE_MS = 14 * 24 * 60 * 60 * 1000
const RUNNING_STALE_MS = 30 * 60 * 1000

function ageMs(iso?: string): number | null {
  const time = Date.parse(iso ?? '')
  if (!Number.isFinite(time)) return null
  return Date.now() - time
}

export async function checkDataHealth(): Promise<DataHealthSummary> {
  const [runs, epics, goalsData] = await Promise.all([
    readExecutionRuns(),
    getEpics(),
    readGoals(),
  ])
  const epicIds = new Set(epics.map((e) => e.epicId))
  const goalIds = new Set(goalsData.goals.map((g) => g.id))
  const issues: DataHealthIssue[] = []

  if (goalsData.readError) {
    issues.push({ kind: 'goals_read_error', ref: 'goals.json', message: `目標データ(goals.json)が読み込めません。手動修復が必要です: ${goalsData.readError}` })
  }

  for (const run of runs) {
    if (run.epicId && !epicIds.has(run.epicId)) {
      issues.push({ kind: 'orphan_epic_ref', ref: run.runId, message: `作業履歴が存在しない大きな作業を参照しています: ${run.epicId}` })
    }
    if (run.reviewStatus === 'needs_followup') {
      const age = ageMs(run.reviewedAt || run.finishedAt || run.startedAt)
      if (age !== null && age > FOLLOWUP_STALE_MS) {
        issues.push({ kind: 'stale_followup', ref: run.runId, message: '14日以上残っている修正依頼があります' })
      }
    }
    if (run.runStatus === 'running') {
      const age = ageMs(run.startedAt)
      if (age === null || age > RUNNING_STALE_MS) {
        issues.push({ kind: 'stale_running', ref: run.runId, message: '30分以上残っている実行中の作業履歴があります' })
      }
    }
  }

  // goals.json が読めない間は goals が空に見えるだけなので、参照切れ扱いにしない（誤検知防止）
  if (!goalsData.readError) {
    for (const epic of epics) {
      if (epic.goalId && !goalIds.has(epic.goalId)) {
        issues.push({ kind: 'missing_goal_ref', ref: epic.epicId, message: `大きな作業が存在しない目標を参照しています: ${epic.goalId}` })
      }
    }
  }

  const warningText = issues.length > 0
    ? `データ整合の確認が必要です（${issues.length}件）。${issues[0].message}`
    : null
  return { ok: issues.length === 0, issues, warningText }
}
