import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { getReviewGeneratedRecommendations } from '@/lib/knowledge-loop'
import type { Goal } from '@/types/goal'
import type { ExecutionRun } from '@/types/execution-run'
import type { Epic } from '@/lib/types/operations'
import type { RecommendedEpic } from '@/types/recommended-epic'

export interface ResumePacket {
  goalId: string
  goalTitle: string
  epicId: string
  epicTitle: string
  status: string
  doneCriteria: string[]
  nextAction: string
  latestRunId: string
  blockers: string[]
  lastReviewSummary: string
  updatedAt: string
  text: string
}

export interface WipWarning {
  scope: 'goal' | 'global'
  goalId?: string
  goalTitle?: string
  activeCount: number
  limit: number
}

export interface DecisionQueueItem {
  id: string
  type: 'approval_waiting' | 'orphan_epic' | 'wip_over' | 'blocker' | 'review_waiting' | 'dropped_candidate' | 'merged_candidate' | 'split_candidate'
  title: string
  description: string
  epic?: Epic
  run?: ExecutionRun
  warning?: WipWarning
}

export interface FactoryDashboard {
  goals: Goal[]
  mainGoal: Goal | null
  northStarGoal: Goal | null
  goalCards: Array<{ goal: Goal; achievement: number; epics: Epic[]; activeEpics: Epic[] }>
  epics: Epic[]
  activeEpics: Epic[]
  orphanEpics: Epic[]
  blockerEpics: Epic[]
  wipWarnings: WipWarning[]
  reviewRuns: ExecutionRun[]
  reviewGeneratedRecommendations: RecommendedEpic[]
  recentRuns: ExecutionRun[]
  nextAiEpic: Epic | null
  decisionQueue: DecisionQueueItem[]
  resumePackets: ResumePacket[]
}

const ACTIVE_STATUSES = new Set(['active', 'approved', 'in_review'])
const OPEN_STATUSES = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

function goalTitle(goals: Goal[], goalId?: string): string {
  if (!goalId) return '未紐付き'
  return goals.find((g) => g.id === goalId)?.title ?? '不明なGoal'
}

function isOpenEpic(epic: Epic): boolean {
  return OPEN_STATUSES.has(epic.status)
}

function isActiveEpic(epic: Epic): boolean {
  return ACTIVE_STATUSES.has(epic.status)
}

export function buildResumePacket(epic: Epic, goals: Goal[], runs: ExecutionRun[]): ResumePacket {
  const goalId = epic.goalId ?? ''
  const latestRun = (epic.latestRunId && runs.find((r) => r.runId === epic.latestRunId))
    || runs.find((r) => r.epicId === epic.epicId)
  const reviewedRun = runs.find((r) => r.epicId === epic.epicId && r.reviewStatus === 'reviewed')
  const blockers = Array.isArray(epic.blockers) ? epic.blockers : []
  const packet = {
    goalId,
    goalTitle: goalTitle(goals, goalId),
    epicId: epic.epicId,
    epicTitle: epic.title,
    status: epic.status,
    doneCriteria: epic.doneCriteria ?? [],
    nextAction: epic.nextAction || '',
    latestRunId: latestRun?.runId ?? epic.latestRunId ?? '',
    blockers,
    lastReviewSummary: epic.lastReviewSummary ?? reviewedRun?.reviewMemo ?? reviewedRun?.summary ?? '',
    updatedAt: epic.updatedAt,
  }
  const text = [
    '# Resume Packet',
    `goalId: ${packet.goalId || '(unassigned)'}`,
    `goalTitle: ${packet.goalTitle}`,
    `epicId: ${packet.epicId}`,
    `epicTitle: ${packet.epicTitle}`,
    `status: ${packet.status}`,
    '',
    '## Done Criteria',
    packet.doneCriteria.length > 0 ? packet.doneCriteria.map((c) => `- ${c}`).join('\n') : '- (none)',
    '',
    '## Next Action',
    packet.nextAction || '(none)',
    '',
    `latestRunId: ${packet.latestRunId || '(none)'}`,
    '',
    '## Blockers',
    packet.blockers.length > 0 ? packet.blockers.map((b) => `- ${b}`).join('\n') : '- (none)',
    '',
    '## Last Review Summary',
    packet.lastReviewSummary || '(none)',
    '',
    `updatedAt: ${packet.updatedAt}`,
  ].join('\n')
  return { ...packet, text }
}

export async function buildFactoryDashboard(): Promise<FactoryDashboard> {
  const [goalsData, epics, pendingApprovals, runs, reviewGeneratedRecommendations] = await Promise.all([
    readGoals(),
    getEpics(),
    getPendingApprovals(),
    readExecutionRuns(),
    getReviewGeneratedRecommendations(),
  ])
  const goals = goalsData.goals
  const mainGoal = goals.find((g) => g.id === goalsData.mainGoalId) ?? null
  const northStarGoal = goals.find((g) => g.isNorthStar) ?? mainGoal
  const openEpics = epics.filter(isOpenEpic)
  const activeEpics = epics.filter(isActiveEpic)
  const goalIds = new Set(goals.map((g) => g.id))
  const orphanEpics = openEpics.filter((e) => !e.goalId || !goalIds.has(e.goalId))
  const blockerEpics = openEpics.filter((e) => e.status === 'blocked' || (e.blockers?.length ?? 0) > 0)
  const reviewRuns = runs.filter((r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup')
  const recentRuns = runs.slice(0, 5)

  const goalCards = goals.map((goal) => {
    const linked = epics.filter((e) => e.goalId === goal.id)
    return {
      goal,
      achievement: goalAchievement(goal),
      epics: linked,
      activeEpics: linked.filter(isActiveEpic),
    }
  })

  const wipWarnings: WipWarning[] = []
  for (const card of goalCards) {
    if (card.activeEpics.length > 3) {
      wipWarnings.push({ scope: 'goal', goalId: card.goal.id, goalTitle: card.goal.title, activeCount: card.activeEpics.length, limit: 3 })
    }
  }
  if (activeEpics.length > 5) {
    wipWarnings.push({ scope: 'global', activeCount: activeEpics.length, limit: 5 })
  }

  const runnable = openEpics
    .filter((e) => e.goalId && goalIds.has(e.goalId))
    .filter((e) => e.status === 'approved' || e.status === 'active')
    .filter((e) => (e.blockers?.length ?? 0) === 0)
    .sort((a, b) => (PRIORITY_ORDER[a.priority ?? 'P2'] ?? 9) - (PRIORITY_ORDER[b.priority ?? 'P2'] ?? 9))
  const nextAiEpic = runnable[0] ?? null

  const decisionQueue: DecisionQueueItem[] = [
    ...epics
      .filter((e) => e.status === 'proposed')
      .map((epic) => ({ id: `approval-${epic.epicId}`, type: 'approval_waiting' as const, title: '承認待ちEpic', description: epic.title, epic })),
    ...pendingApprovals.map((approval) => {
      const epic = approval.epicId ? epics.find((e) => e.epicId === approval.epicId) : undefined
      return { id: `approvalq-${approval.approvalId}`, type: 'approval_waiting' as const, title: '承認待ちEpic', description: approval.title, epic }
    }),
    ...orphanEpics.map((epic) => ({ id: `orphan-${epic.epicId}`, type: 'orphan_epic' as const, title: 'Goal未紐付きEpic', description: epic.title, epic })),
    ...wipWarnings.map((warning, i) => ({ id: `wip-${i}`, type: 'wip_over' as const, title: 'WIP超過', description: warning.scope === 'global' ? `全体 active ${warning.activeCount}/${warning.limit}` : `${warning.goalTitle} active ${warning.activeCount}/${warning.limit}`, warning })),
    ...blockerEpics.map((epic) => ({ id: `blocker-${epic.epicId}`, type: 'blocker' as const, title: 'blockerありEpic', description: epic.title, epic })),
    ...reviewRuns.slice(0, 8).map((run) => ({ id: `review-${run.runId}`, type: 'review_waiting' as const, title: 'review待ちExecution', description: run.summary || run.targetTodoTitle, run })),
    ...epics.filter((e) => e.status === 'dropped').slice(0, 3).map((epic) => ({ id: `dropped-${epic.epicId}`, type: 'dropped_candidate' as const, title: 'dropped候補', description: epic.title, epic })),
    ...epics.filter((e) => e.status === 'merged').slice(0, 3).map((epic) => ({ id: `merged-${epic.epicId}`, type: 'merged_candidate' as const, title: 'merged候補', description: epic.title, epic })),
    ...epics.filter((e) => e.status === 'split').slice(0, 3).map((epic) => ({ id: `split-${epic.epicId}`, type: 'split_candidate' as const, title: 'split候補', description: epic.title, epic })),
  ].slice(0, 24)

  const resumePackets = openEpics.slice(0, 8).map((epic) => buildResumePacket(epic, goals, runs))

  return {
    goals,
    mainGoal,
    northStarGoal,
    goalCards,
    epics,
    activeEpics,
    orphanEpics,
    blockerEpics,
    wipWarnings,
    reviewRuns,
    reviewGeneratedRecommendations,
    recentRuns,
    nextAiEpic,
    decisionQueue,
    resumePackets,
  }
}
