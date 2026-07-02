import { appendAutomationLog, getEpic, updateEpic } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { updateExecutionRunFields } from '@/lib/execution-run-writer'
import { propagateEpicDoneToGoal } from '@/lib/factory-runner'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import type { Approval } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function latestFailedRun(runs: ExecutionRun[], epicId: string): ExecutionRun | undefined {
  return runs
    .filter((run) => run.epicId === epicId && run.runStatus === 'failed')
    .sort((a, b) => Date.parse(b.finishedAt || b.startedAt) - Date.parse(a.finishedAt || a.startedAt))[0]
}

async function markRetryApproved(epicId: string, investigate: boolean): Promise<string> {
  const run = latestFailedRun(await readExecutionRuns(), epicId)
  if (!run) return 'none:no_failed_run'
  const stopReason = run.stopReason?.includes('retry_approved')
    ? run.stopReason
    : `${run.stopReason ?? 'failed'} / retry_approved`
  await updateExecutionRunFields(run.runId, {
    stopReason,
    ...(investigate ? {
      fixPrompt: '前回失敗の原因を調査し、原因と対処方針をまとめてから修正する',
      fixRequestedAt: new Date().toISOString(),
      fixRequestedBy: 'human',
      reviewStatus: 'needs_followup',
    } : {}),
  })
  return investigate ? `investigate:${run.runId}` : `retry:${run.runId}`
}

async function pauseGoal(goalId: string): Promise<boolean> {
  const data = await readGoals()
  const idx = data.goals.findIndex((goal) => goal.id === goalId)
  if (idx === -1) return false
  data.goals[idx] = { ...data.goals[idx], status: 'paused', updatedAt: new Date().toISOString() }
  await writeGoals(data)
  return true
}

async function applyApprovalEffectInner(approval: Approval, decidedOption: string): Promise<string> {
  if (!approval.epicId) return 'none'
  const epic = await getEpic(approval.epicId)
  if (!epic) return 'none:epic_not_found'

  if (decidedOption === 'mark_done') {
    await updateEpic(epic.epicId, { status: 'done', progress: 100 })
    await propagateEpicDoneToGoal(epic.epicId, epic.goalId)
    return 'epic_done'
  }

  if (decidedOption === 'cancel') {
    await updateEpic(epic.epicId, { status: 'dropped' })
    if (epic.epicId.startsWith('epic-goalstep-') && epic.goalId) {
      const paused = await pauseGoal(epic.goalId)
      return paused ? 'epic_dropped_goal_paused' : 'epic_dropped'
    }
    return 'epic_dropped'
  }

  if (decidedOption === 'hold' || decidedOption === 'later' || decidedOption === 'keep') {
    await updateEpic(epic.epicId, {
      queueControl: {
        ...epic.queueControl,
        hold: true,
        updatedBy: 'user',
        updatedAt: new Date().toISOString(),
      },
    })
    return 'epic_hold'
  }

  if (decidedOption === 'retry') return markRetryApproved(epic.epicId, false)
  if (decidedOption === 'investigate') return markRetryApproved(epic.epicId, true)

  if (decidedOption === 'proceed' || decidedOption === 'resolve' || decidedOption === 'allow') {
    return 'none'
  }

  return 'none'
}

export async function applyApprovalEffect(approval: Approval, decidedOption: string): Promise<{ applied: string }> {
  let applied = 'none'
  try {
    applied = await applyApprovalEffectInner(approval, decidedOption)
  } catch (err) {
    applied = `error:${errorMessage(err)}`
  }

  try {
    await appendAutomationLog({
      event: 'approval_effect_applied',
      epicId: approval.epicId,
      fallbackReason: `${approval.approvalId} ${decidedOption} → ${applied}`,
    })
  } catch {
    // 承認の適用結果を返すことを優先し、ログ失敗では止めない。
  }

  return { applied }
}
