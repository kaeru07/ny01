import { getEpic, getEpics, updateEpic } from './operations-store'
import { readGoals } from './goal-reader'
import { writeGoals } from './goal-writer'
import { applyCompletedEpicToGoalData } from './goal-completion-sync'
import type { Epic } from './types/operations'

// レビュー(問題なし)→Epic done→Goal完了伝播 の共通入口。
// doneCriteria 自動判定が常に continue（例: goalstep の 2/3）で Epic が閉じず、
// 完了済み Run が review_waiting に滞留する問題を、人間の「reviewed」操作で確定的に閉じる。

const TERMINAL_EPIC_STATUSES = new Set<Epic['status']>(['done', 'merged', 'split', 'dropped'])

export interface EpicFinalizeResult {
  finalized: boolean
  epicId: string
  reason?: string
  goalId?: string
  goalCompleted: boolean
  todoSynced: number
  phaseSynced: number
}

/**
 * Epic を done にし、Goal/GoalTodo/Phase へ完了を伝播する。
 * 既に終端状態の Epic は何もしない（多重確定・巻き戻しを防ぐ）。
 */
export async function finalizeEpicAsDone(epicId: string): Promise<EpicFinalizeResult> {
  const epic = await getEpic(epicId)
  if (!epic) {
    return { finalized: false, epicId, reason: 'epic_not_found', goalCompleted: false, todoSynced: 0, phaseSynced: 0 }
  }
  if (TERMINAL_EPIC_STATUSES.has(epic.status)) {
    return { finalized: false, epicId, reason: `already_${epic.status}`, goalId: epic.goalId, goalCompleted: false, todoSynced: 0, phaseSynced: 0 }
  }

  await updateEpic(epicId, { status: 'done', progress: 100 })

  const [epics, goalsData] = await Promise.all([getEpics(), readGoals()])
  const result = applyCompletedEpicToGoalData(goalsData, epics, {
    epicId,
    goalId: epic.goalId,
    relatedTodoIds: epic.relatedTodoIds,
  })
  if (result.todoSynced > 0 || result.phaseSynced > 0 || result.goalCompleted) {
    await writeGoals(goalsData)
  }

  return {
    finalized: true,
    epicId,
    goalId: result.goalId,
    goalCompleted: result.goalCompleted,
    todoSynced: result.todoSynced,
    phaseSynced: result.phaseSynced,
  }
}
