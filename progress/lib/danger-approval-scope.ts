import type { Approval, Epic } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'

export interface DangerApprovalScope {
  approvalId: string
  projectId?: string
  goalId?: string
  epicId?: string
  source: 'approval_project' | 'epic_goal_project' | 'epic' | 'run_target_app'
}

export interface DangerApprovalScopeSummary {
  scoped: DangerApprovalScope[]
  unscoped: Approval[]
  blockedProjectIds: Set<string>
  blockedGoalIds: Set<string>
  blockedEpicIds: Set<string>
}

export interface ScopeMatchInput {
  projectId?: string
  goalId?: string
  epicId?: string
}

export function resolveDangerApprovalScope(
  approval: Approval,
  context: {
    epics: Pick<Epic, 'epicId' | 'goalId'>[]
    goals: Pick<Goal, 'id' | 'projectId'>[]
    runs: Pick<ExecutionRun, 'runId' | 'targetApp'>[]
  },
): DangerApprovalScope | null {
  if (approval.projectId) {
    return { approvalId: approval.approvalId, projectId: approval.projectId, source: 'approval_project' }
  }

  if (approval.epicId) {
    const epic = context.epics.find((item) => item.epicId === approval.epicId)
    if (epic) {
      const goal = epic.goalId ? context.goals.find((item) => item.id === epic.goalId) : undefined
      return {
        approvalId: approval.approvalId,
        epicId: epic.epicId,
        goalId: epic.goalId,
        projectId: goal?.projectId,
        source: goal?.projectId ? 'epic_goal_project' : 'epic',
      }
    }
  }

  if (approval.createdRunId) {
    const run = context.runs.find((item) => item.runId === approval.createdRunId)
    if (run?.targetApp) {
      return { approvalId: approval.approvalId, projectId: run.targetApp, source: 'run_target_app' }
    }
  }

  return null
}

export function summarizeDangerApprovalScopes(
  approvals: Approval[],
  context: Parameters<typeof resolveDangerApprovalScope>[1],
): DangerApprovalScopeSummary {
  const summary: DangerApprovalScopeSummary = {
    scoped: [],
    unscoped: [],
    blockedProjectIds: new Set<string>(),
    blockedGoalIds: new Set<string>(),
    blockedEpicIds: new Set<string>(),
  }

  for (const approval of approvals) {
    const scope = resolveDangerApprovalScope(approval, context)
    if (!scope) {
      summary.unscoped.push(approval)
      continue
    }
    summary.scoped.push(scope)
    if (scope.projectId) summary.blockedProjectIds.add(scope.projectId)
    if (scope.goalId) summary.blockedGoalIds.add(scope.goalId)
    if (scope.epicId) summary.blockedEpicIds.add(scope.epicId)
  }

  return summary
}

export function matchesDangerBlockedScope(
  input: ScopeMatchInput,
  summary: Pick<DangerApprovalScopeSummary, 'blockedProjectIds' | 'blockedGoalIds' | 'blockedEpicIds'>,
  context?: {
    epics?: Pick<Epic, 'epicId' | 'goalId'>[]
    goals?: Pick<Goal, 'id' | 'projectId'>[]
  },
): boolean {
  if (input.projectId && summary.blockedProjectIds.has(input.projectId)) return true
  if (input.goalId && summary.blockedGoalIds.has(input.goalId)) return true
  if (input.epicId && summary.blockedEpicIds.has(input.epicId)) return true

  const epic = input.epicId ? context?.epics?.find((item) => item.epicId === input.epicId) : undefined
  const goalId = input.goalId ?? epic?.goalId
  if (goalId && summary.blockedGoalIds.has(goalId)) return true

  const goal = goalId ? context?.goals?.find((item) => item.id === goalId) : undefined
  const projectId = input.projectId ?? goal?.projectId
  return Boolean(projectId && summary.blockedProjectIds.has(projectId))
}

export function dangerScopeLabels(summary: Pick<DangerApprovalScopeSummary, 'blockedProjectIds' | 'blockedGoalIds' | 'blockedEpicIds'>): string[] {
  const projects = Array.from(summary.blockedProjectIds).map((id) => `Project「${id}」`)
  if (projects.length > 0) return projects
  const goals = Array.from(summary.blockedGoalIds).map((id) => `Goal「${id}」`)
  if (goals.length > 0) return goals
  const epics = Array.from(summary.blockedEpicIds).map((id) => `Epic「${id}」`)
  return epics.length > 0 ? epics : ['対象プロジェクト']
}
