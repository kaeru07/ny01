import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStalledGoals } from './stalled-goals.ts'
import type { Goal, GoalTodo } from '@/types/goal'

const NOW = Date.parse('2026-07-08T00:00:00.000Z')

function todo(patch: Partial<GoalTodo> = {}): GoalTodo {
  return {
    id: 'todo-1',
    goalId: 'goal-1',
    phaseId: 'phase-1',
    title: '作業する',
    role: 'codex',
    order: 0,
    priority: 'medium',
    nextAction: '',
    doneCriteria: [],
    taskPrompt: '',
    memo: '',
    status: 'pending',
    dependsOn: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...patch,
  }
}

function goal(patch: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    title: 'テストゴール',
    summary: '',
    status: 'active',
    priority: 'medium',
    monetizationImpact: 'none',
    phases: [],
    todos: [],
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    approvedAt: '2026-06-01T00:00:00.000Z',
    ...patch,
  }
}

test('computeStalledGoals: todos0 の active goal を stalled として検出する', () => {
  const result = computeStalledGoals([goal()], NOW)

  assert.equal(result.length, 1)
  assert.equal(result[0].severity, 'stalled')
  assert.match(result[0].cause, /自動実行できるタスクが無い/)
  assert.equal(result[0].prospect, 'needs_decision')
})

test('computeStalledGoals: 全 todo done/skipped の active goal は done化漏れとして検出する', () => {
  const result = computeStalledGoals([
    goal({
      todos: [
        todo({ status: 'done' }),
        todo({ id: 'todo-2', status: 'skipped' }),
      ],
    }),
  ], NOW)

  assert.equal(result.length, 1)
  assert.match(result[0].cause, /done化漏れ/)
  assert.equal(result[0].prospect, 'likely')
})

test('computeStalledGoals: 最後の前進から7日未満は対象外', () => {
  const result = computeStalledGoals([
    goal({
      lastSelectedAt: '2026-07-03T00:00:00.000Z',
      todos: [todo({ updatedAt: '2026-07-03T00:00:00.000Z' })],
    }),
  ], NOW)

  assert.equal(result.length, 0)
})
