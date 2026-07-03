import { buildAutoQueue } from '@/lib/auto-queue'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { getEpics } from '@/lib/operations-store'
import type { AppProposal, AppProposalPipelineStatus } from '@/lib/app-proposals'
import type { Goal } from '@/types/goal'

// 承認済みアプリ案の「進行状態」を goal-app-<projectId> のゴール/キュー実状態から導出する。
// app-proposals(決定済みタブ) と app-designs(設計一覧) の両方で共有する（片方だけ付与漏れになるのを防ぐ）。
export async function attachPipelineStatuses(proposals: AppProposal[]): Promise<AppProposal[]> {
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
