import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { finalizeEpicAsDone } from './epic-finalize.ts'

let dir: string
let prevDataPath: string | undefined

async function seed(epics: unknown[], goals: unknown[]): Promise<void> {
  await fs.writeFile(path.join(dir, 'epics.json'), JSON.stringify(epics), 'utf-8')
  await fs.writeFile(path.join(dir, 'goals.json'), JSON.stringify({
    goals,
    mainGoalId: undefined,
    updatedAt: '2026-07-09T00:00:00.000Z',
  }), 'utf-8')
}

async function readEpics(): Promise<any[]> {
  return JSON.parse(await fs.readFile(path.join(dir, 'epics.json'), 'utf-8'))
}
async function readGoalsRaw(): Promise<any> {
  return JSON.parse(await fs.readFile(path.join(dir, 'goals.json'), 'utf-8'))
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'epic-finalize-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('finalizeEpicAsDone: Epic を done にし、唯一のゴールなら Goal を完了まで伝播する', async () => {
  await seed(
    [{ epicId: 'epic-1', goalId: 'goal-1', status: 'active', relatedTodoIds: ['todo-1'] }],
    [{
      id: 'goal-1',
      title: 'テストゴール',
      status: 'active',
      target: 100,
      current: 40,
      phases: [{ id: 'phase-1', title: '実装', order: 0, status: 'in_progress' }],
      todos: [{ id: 'todo-1', goalId: 'goal-1', phaseId: 'phase-1', title: 't', role: 'claude', status: 'active' }],
      createdAt: '2026-07-09T00:00:00.000Z',
      updatedAt: '2026-07-09T00:00:00.000Z',
    }],
  )

  const result = await finalizeEpicAsDone('epic-1')
  assert.equal(result.finalized, true)
  assert.equal(result.goalCompleted, true)
  assert.equal(result.todoSynced, 1)

  const epics = await readEpics()
  assert.equal(epics[0].status, 'done')
  assert.equal(epics[0].progress, 100)

  const goals = await readGoalsRaw()
  assert.equal(goals.goals[0].status, 'done')
  assert.equal(goals.goals[0].todos[0].status, 'done')
  assert.equal(goals.goals[0].current, 100)
})

test('finalizeEpicAsDone: 他に open な自動 todo が残るゴールは完了させない（Epic だけ done）', async () => {
  await seed(
    [{ epicId: 'epic-1', goalId: 'goal-1', status: 'active', relatedTodoIds: ['todo-1'] }],
    [{
      id: 'goal-1',
      title: 'テストゴール',
      status: 'active',
      target: 100,
      current: 40,
      phases: [{ id: 'phase-1', title: '実装', order: 0, status: 'in_progress' }],
      todos: [
        { id: 'todo-1', goalId: 'goal-1', phaseId: 'phase-1', title: 't1', role: 'claude', status: 'active' },
        { id: 'todo-2', goalId: 'goal-1', phaseId: 'phase-1', title: 't2', role: 'claude', status: 'active' },
      ],
      createdAt: '2026-07-09T00:00:00.000Z',
      updatedAt: '2026-07-09T00:00:00.000Z',
    }],
  )

  const result = await finalizeEpicAsDone('epic-1')
  assert.equal(result.finalized, true)
  assert.equal(result.goalCompleted, false)

  const goals = await readGoalsRaw()
  assert.equal(goals.goals[0].status, 'active')
  assert.equal((await readEpics())[0].status, 'done')
})

test('finalizeEpicAsDone: 既に done の Epic は何もしない（多重確定を防ぐ）', async () => {
  await seed([{ epicId: 'epic-1', goalId: 'goal-1', status: 'done', relatedTodoIds: [] }], [])
  const result = await finalizeEpicAsDone('epic-1')
  assert.equal(result.finalized, false)
  assert.equal(result.reason, 'already_done')
})

test('finalizeEpicAsDone: 存在しない Epic は epic_not_found を返す', async () => {
  await seed([], [])
  const result = await finalizeEpicAsDone('missing')
  assert.equal(result.finalized, false)
  assert.equal(result.reason, 'epic_not_found')
})
