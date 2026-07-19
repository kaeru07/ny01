import { appendAutomationLog, getEpic, getPendingApprovals, updateEpic } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { updateExecutionRunFields } from '@/lib/execution-run-writer'
import { propagateEpicDoneToGoal } from '@/lib/factory-runner'
import { readGoals } from '@/lib/goal-reader'
import { writeGoals } from '@/lib/goal-writer'
import { applySkillImprovement } from '@/lib/skill-apply'
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

function skillCandidateIdFromApproval(approval: Approval): string | undefined {
  if (approval.projectId?.startsWith('skills:')) return approval.projectId.slice('skills:'.length)
  return approval.reason.match(/candidate:([A-Za-z0-9._:-]+)/)?.[1]
    ?? approval.title.match(/candidate:([A-Za-z0-9._:-]+)/)?.[1]
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

async function releaseGoalHoldForProject(projectId: string): Promise<string> {
  const pendingRequired = (await getPendingApprovals()).some((item) => (
    item.projectId === projectId
    && item.requiredForExecution === true
    && item.status === 'pending'
  ))
  if (pendingRequired) return 'none'

  const data = await readGoals()
  const goalIndex = data.goals.findIndex((goal) => goal.id === `goal-app-${projectId}`)
  const fallbackIndex = data.goals.findIndex((goal) => goal.projectId === projectId && goal.status === 'active')
  const targetIndex = goalIndex >= 0 ? goalIndex : fallbackIndex
  if (targetIndex === -1) return 'none'

  const goal = data.goals[targetIndex]
  if (goal.queueControl?.hold !== true) return 'none'
  data.goals[targetIndex] = {
    ...goal,
    queueControl: {
      ...goal.queueControl,
      hold: false,
      updatedBy: 'user',
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  }
  await writeGoals(data)
  return 'required_answered_release'
}

async function applyApprovalEffectInner(approval: Approval, decidedOption: string): Promise<string> {
  if (approval.projectId === 'skills' || approval.projectId?.startsWith('skills:')) {
    const selectedLabel = approval.options.find((option) => option.key === decidedOption)?.label ?? decidedOption
    const shouldApply = decidedOption === 'apply' || decidedOption === 'approve' || selectedLabel.includes('反映する')
    if (!shouldApply) return decidedOption === 'reject' || selectedLabel.includes('却下') ? 'skill_rejected' : 'skill_hold'
    const candidateId = skillCandidateIdFromApproval(approval)
    if (!candidateId) return 'skill_apply:none:candidate_not_found'
    const result = await applySkillImprovement(candidateId)
    return result.applied ? `skill_apply:${candidateId}` : `skill_apply:none:${result.reason}`
  }

  const releaseApplied = approval.requiredForExecution && approval.projectId
    ? await releaseGoalHoldForProject(approval.projectId)
    : 'none'
  if (!approval.epicId) return releaseApplied
  const epic = await getEpic(approval.epicId)
  if (!epic) return releaseApplied !== 'none' ? releaseApplied : 'none:epic_not_found'

  if (decidedOption === 'mark_done') {
    await updateEpic(epic.epicId, { status: 'done', progress: 100 })
    await propagateEpicDoneToGoal(epic.epicId, epic.goalId)
    return releaseApplied !== 'none' ? `epic_done+${releaseApplied}` : 'epic_done'
  }

  if (decidedOption === 'cancel') {
    await updateEpic(epic.epicId, { status: 'dropped' })
    if (epic.epicId.startsWith('epic-goalstep-') && epic.goalId) {
      const paused = await pauseGoal(epic.goalId)
      const dropped = paused ? 'epic_dropped_goal_paused' : 'epic_dropped'
      return releaseApplied !== 'none' ? `${dropped}+${releaseApplied}` : dropped
    }
    return releaseApplied !== 'none' ? `epic_dropped+${releaseApplied}` : 'epic_dropped'
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
    return releaseApplied !== 'none' ? `epic_hold+${releaseApplied}` : 'epic_hold'
  }

  if (decidedOption === 'retry') {
    const retry = await markRetryApproved(epic.epicId, false)
    return releaseApplied !== 'none' ? `${retry}+${releaseApplied}` : retry
  }
  if (decidedOption === 'investigate') {
    const investigate = await markRetryApproved(epic.epicId, true)
    return releaseApplied !== 'none' ? `${investigate}+${releaseApplied}` : investigate
  }

  if (decidedOption === 'proceed' || decidedOption === 'resolve' || decidedOption === 'allow') {
    return releaseApplied
  }

  return releaseApplied
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
