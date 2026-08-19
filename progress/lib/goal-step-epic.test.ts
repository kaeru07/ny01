import './test-alias.cjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sourceTodoForGoal } from './goal-step-epic.ts'
import type { Goal, GoalTodo } from '@/types/goal'

function todo(id: string, patch: Partial<GoalTodo> = {}): GoalTodo {
  return {
    id,
    goalId: 'goal-1',
    phaseId: 'phase-1',
    title: `Todo ${id}`,
    role: 'codex',
    order: 0,
    priority: 'medium',
    nextAction: '',
    doneCriteria: [],
    taskPrompt: '',
    memo: '',
    status: 'pending',
    dependsOn: [],
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    ...patch,
  }
}

function goal(todos: GoalTodo[]): Goal {
  return {
    id: 'goal-1',
    title: '深掘り挙動を調整する',
    summary: '',
    status: 'active',
    priority: 'medium',
    monetizationImpact: 'none',
    phases: [],
    todos,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
  }
}

test('sourceTodoForGoal: Goal選択でも実行可能Todoが1件なら完了同期用に関連付ける', () => {
  const onlyOpenTodo = todo('todo-open')
  const source = sourceTodoForGoal(goal([
    onlyOpenTodo,
    todo('todo-done', { status: 'done' }),
    todo('todo-human', { role: 'human' }),
  ]))

  assert.equal(source?.id, 'todo-open')
})

test('sourceTodoForGoal: 実行可能Todoが複数なら暗黙選択しない', () => {
  const source = sourceTodoForGoal(goal([todo('todo-1'), todo('todo-2')]))

  assert.equal(source, undefined)
})

test('sourceTodoForGoal: Todo ID明示時は従来どおり指定Todoを優先する', () => {
  const source = sourceTodoForGoal(goal([todo('todo-1'), todo('todo-2')]), 'todo-2')

  assert.equal(source?.id, 'todo-2')
})
