import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyCompletedEpicToGoalData, shouldFinalizeEpicFromManualRun } from './goal-completion-sync.ts'
import type { Epic } from './types/operations.ts'
import type { Goal, GoalsData } from '@/types/goal'

function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: '古いキュー残留を直す',
    summary: '',
    status: 'active',
    priority: 'medium',
    monetizationImpact: 'none',
    target: 100,
    current: 40,
    phases: [{ id: 'phase-1', title: '実装', summary: '', order: 0, status: 'in_progress' }],
    todos: [{
      id: 'todo-1',
      goalId: 'goal-1',
      phaseId: 'phase-1',
      title: '完了RunをGoalTodoへ反映する',
      role: 'codex',
      order: 0,
      priority: 'high',
      nextAction: '',
      doneCriteria: [],
      taskPrompt: '',
      memo: '',
      status: 'active',
      dependsOn: [],
      createdAt: '2026-07-05T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
    }],
    createdAt: '2026-07-05T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...patch,
  }
}

function epic(patch: Partial<Epic> = {}): Epic {
  return {
    epicId: 'epic-1',
    goalId: 'goal-1',
    title: '完了Runを同期する',
    goal: '',
    progress: 100,
    remainingWork: [],
    nextAction: '',
    decisionPolicy: 'autonomous',
    status: 'done',
    relatedTodoIds: ['todo-1'],
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...patch,
  }
}

test('applyCompletedEpicToGoalData: completed epic consumes related GoalTodo before closing goal', () => {
  const data: GoalsData = { goals: [goal()], updatedAt: '' }
  const result = applyCompletedEpicToGoalData(data, [epic()], epic(), '2026-07-05T01:00:00.000Z')

  assert.deepEqual(result, {
    goalId: 'goal-1',
    todoSynced: 1,
    phaseSynced: 1,
    goalCompleted: true,
  })
  assert.equal(data.goals[0].todos[0].status, 'done')
  assert.equal(data.goals[0].phases[0].status, 'done')
  assert.equal(data.goals[0].status, 'done')
  assert.equal(data.goals[0].current, 100)
})

test('applyCompletedEpicToGoalData: open sibling epic keeps goal active after todo sync', () => {
  const data: GoalsData = { goals: [goal()], updatedAt: '' }
  const result = applyCompletedEpicToGoalData(
    data,
    [epic(), epic({ epicId: 'epic-2', status: 'active', relatedTodoIds: [] })],
    epic(),
    '2026-07-05T01:00:00.000Z',
  )

  assert.equal(result.todoSynced, 1)
  assert.equal(result.goalCompleted, false)
  assert.equal(data.goals[0].todos[0].status, 'done')
  assert.equal(data.goals[0].status, 'active')
})

test('applyCompletedEpicToGoalData: app goal consumes todo but does not close the app goal', () => {
  const sourceGoal = goal()
  const data: GoalsData = {
    goals: [goal({
      id: 'goal-app-progress',
      todos: [{ ...sourceGoal.todos[0], goalId: 'goal-app-progress' }],
    })],
    updatedAt: '',
  }
  const completed = epic({ goalId: 'goal-app-progress' })
  const result = applyCompletedEpicToGoalData(data, [completed], completed, '2026-07-05T01:00:00.000Z')

  assert.equal(result.todoSynced, 1)
  assert.equal(result.goalCompleted, false)
  assert.equal(data.goals[0].todos[0].status, 'done')
  assert.equal(data.goals[0].status, 'active')
})

test('shouldFinalizeEpicFromManualRun: doneCriteriaStatus=done 明示 + completed + open Epic で起動する', () => {
  assert.equal(shouldFinalizeEpicFromManualRun({
    doneCriteriaStatus: 'done',
    runStatus: 'completed',
    explicitEpicId: 'epic-1',
    epicStatus: 'active',
  }), true)
})

test('shouldFinalizeEpicFromManualRun: doneCriteriaStatus 未指定 / continue では起動しない', () => {
  assert.equal(shouldFinalizeEpicFromManualRun({
    runStatus: 'completed',
    explicitEpicId: 'epic-1',
    epicStatus: 'active',
  }), false)
  assert.equal(shouldFinalizeEpicFromManualRun({
    doneCriteriaStatus: 'continue',
    runStatus: 'completed',
    explicitEpicId: 'epic-1',
    epicStatus: 'active',
  }), false)
})

test('shouldFinalizeEpicFromManualRun: completed 以外の runStatus では起動しない', () => {
  for (const runStatus of ['partial', 'failed', 'running']) {
    assert.equal(shouldFinalizeEpicFromManualRun({
      doneCriteriaStatus: 'done',
      runStatus,
      explicitEpicId: 'epic-1',
      epicStatus: 'active',
    }), false)
  }
})

test('shouldFinalizeEpicFromManualRun: epicId 明示なし / Epic status 不明では起動しない', () => {
  assert.equal(shouldFinalizeEpicFromManualRun({
    doneCriteriaStatus: 'done',
    runStatus: 'completed',
    epicStatus: 'active',
  }), false)
  assert.equal(shouldFinalizeEpicFromManualRun({
    doneCriteriaStatus: 'done',
    runStatus: 'completed',
    explicitEpicId: 'epic-1',
  }), false)
})

test('shouldFinalizeEpicFromManualRun: 終端status（done/merged/split/dropped）のEpicは再処理しない', () => {
  for (const epicStatus of ['done', 'merged', 'split', 'dropped'] as const) {
    assert.equal(shouldFinalizeEpicFromManualRun({
      doneCriteriaStatus: 'done',
      runStatus: 'completed',
      explicitEpicId: 'epic-1',
      epicStatus,
    }), false)
  }
  for (const epicStatus of ['proposed', 'approved', 'paused', 'in_review', 'blocked'] as const) {
    assert.equal(shouldFinalizeEpicFromManualRun({
      doneCriteriaStatus: 'done',
      runStatus: 'completed',
      explicitEpicId: 'epic-1',
      epicStatus,
    }), true)
  }
})
