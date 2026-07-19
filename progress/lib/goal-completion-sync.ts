import type { Epic } from './types/operations'
import type { Goal, GoalsData } from '@/types/goal'

const OPEN_EPIC_STATUSES = new Set(['active', 'approved', 'paused'])
const TERMINAL_EPIC_STATUSES = new Set<Epic['status']>(['done', 'merged', 'split', 'dropped'])

export interface GoalCompletionSyncResult {
  goalId?: string
  todoSynced: number
  phaseSynced: number
  goalCompleted: boolean
}

function markRelatedTodosDone(goal: Goal, relatedTodoIds: string[], now: string): number {
  if (relatedTodoIds.length === 0) return 0
  const ids = new Set(relatedTodoIds)
  let synced = 0
  for (const todo of goal.todos) {
    if (!ids.has(todo.id)) continue
    if (todo.status === 'done' || todo.status === 'skipped') continue
    todo.status = 'done'
    todo.updatedAt = now
    synced += 1
  }
  return synced
}

function syncDonePhases(goal: Goal, now: string): number {
  let synced = 0
  for (const phase of goal.phases) {
    if (phase.status === 'done') continue
    const phaseTodos = goal.todos.filter((todo) => todo.phaseId === phase.id)
    if (phaseTodos.length === 0) continue
    const allDone = phaseTodos.every((todo) => todo.status === 'done' || todo.status === 'skipped')
    if (!allDone) continue
    phase.status = 'done'
    synced += 1
  }
  if (synced > 0) goal.updatedAt = now
  return synced
}

export interface ManualRunFinalizeInput {
  /** POST body で明示された doneCriteriaStatus。'done' 以外は完了後処理を起動しない。 */
  doneCriteriaStatus?: unknown
  runStatus: string
  /** POST body で明示された epicId。自動結合された epicId では完了後処理しない。 */
  explicitEpicId?: string
  epicStatus?: Epic['status']
}

/**
 * 手動POSTされたRunがEpic完了後処理（status=done + Goal/GoalTodo同期）を起動できるか判定する。
 * factory-runner 経由の Run は doneCriteria 自動判定で同じ処理を通るため、ここは
 * Factory Dispatch manual_copy 等の「手動戻しRun」の反映漏れだけを塞ぐ。
 */
export function shouldFinalizeEpicFromManualRun(input: ManualRunFinalizeInput): boolean {
  if (input.doneCriteriaStatus !== 'done') return false
  if (input.runStatus !== 'completed') return false
  if (!input.explicitEpicId) return false
  if (!input.epicStatus) return false
  return !TERMINAL_EPIC_STATUSES.has(input.epicStatus)
}

export function applyCompletedEpicToGoalData(
  goalsData: GoalsData,
  epics: Array<Pick<Epic, 'epicId' | 'goalId' | 'status'>>,
  completedEpic: Pick<Epic, 'epicId' | 'goalId' | 'relatedTodoIds'>,
  now = new Date().toISOString(),
): GoalCompletionSyncResult {
  if (!completedEpic.goalId) {
    return { todoSynced: 0, phaseSynced: 0, goalCompleted: false }
  }

  const goal = goalsData.goals.find((g) => g.id === completedEpic.goalId)
  if (!goal || goal.status !== 'active') {
    return { goalId: completedEpic.goalId, todoSynced: 0, phaseSynced: 0, goalCompleted: false }
  }

  const todoSynced = markRelatedTodosDone(goal, completedEpic.relatedTodoIds ?? [], now)
  const phaseSynced = syncDonePhases(goal, now)
  if (todoSynced > 0) goal.updatedAt = now

  // アプリ作成ゴール(goal-app-*)は1つの「次の一歩」Epic完了で閉じない。
  if (completedEpic.goalId.startsWith('goal-app-')) {
    return { goalId: completedEpic.goalId, todoSynced, phaseSynced, goalCompleted: false }
  }

  const hasOtherOpenEpic = epics.some((epic) => (
    epic.goalId === completedEpic.goalId &&
    epic.epicId !== completedEpic.epicId &&
    OPEN_EPIC_STATUSES.has(epic.status)
  ))
  const hasOpenAutoTodo = goal.todos.some((todo) => (
    todo.role !== 'human' &&
    todo.status !== 'done' &&
    todo.status !== 'skipped'
  ))
  if (hasOtherOpenEpic || hasOpenAutoTodo) {
    return { goalId: completedEpic.goalId, todoSynced, phaseSynced, goalCompleted: false }
  }

  goal.status = 'done'
  goal.current = typeof goal.target === 'number' ? goal.target : goal.current
  goal.updatedAt = now
  return { goalId: completedEpic.goalId, todoSynced, phaseSynced, goalCompleted: true }
}
