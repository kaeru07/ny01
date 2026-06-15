import type { Epic } from '@/lib/types/operations'

export const AUTONOMY_GOAL_ID = 'goal-ai-factory-os'
export const AUTONOMY_EPIC_ID = 'epic-91'

export const REVIEW_FIX_SCORE_BOOST = 2_000
export const AUTONOMY_ANCHOR_SCORE_BOOST = 1_000

export function isAutonomyGoal(goalId?: string): boolean {
  return goalId === AUTONOMY_GOAL_ID
}

export function isAutonomyAnchorEpic(epic: Pick<Epic, 'epicId' | 'goalId' | 'factoryEligible' | 'doneCriteria' | 'decisionPolicy' | 'riskFlags' | 'status'>): boolean {
  return (
    epic.epicId === AUTONOMY_EPIC_ID &&
    epic.goalId === AUTONOMY_GOAL_ID &&
    epic.factoryEligible === true &&
    Array.isArray(epic.doneCriteria) &&
    epic.doneCriteria.length > 0 &&
    epic.decisionPolicy === 'autonomous' &&
    !['done', 'merged', 'dropped', 'split', 'blocked', 'paused'].includes(epic.status) &&
    !(epic.riskFlags ?? []).some((flag) => ['billing', 'production_db', 'auth_secret', 'external_publish', 'destructive', 'migration'].includes(flag))
  )
}

export function autonomyAnchorReason(): string {
  return '自走化・最優先アンカー: goal-ai-factory-os を次回自動実行へ戻すため'
}
