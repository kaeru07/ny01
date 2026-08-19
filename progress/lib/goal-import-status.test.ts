import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { importGoal } from './goal-writer.ts'
import { readGoals } from './goal-reader.ts'

let dir: string
let prevDataPath: string | undefined

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'goal-import-status-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
  await fs.writeFile(path.join(dir, 'project-tasks.json'), JSON.stringify({ projects: [] }), 'utf-8')
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('importGoal preserves imported goal status', async () => {
  const result = await importGoal({
    projectId: 'company-mgmt',
    goalTitle: '収益化候補: 状態引き継ぎテスト',
    status: 'proposed',
    phases: [{ id: 'phase-1', title: '移行', status: 'todo' }],
    todos: [{ id: 'todo-1', phaseId: 'phase-1', title: '次アクションを確認する', status: 'pending' }],
  }, { projects: [{ id: 'company-mgmt', name: 'Company Management' }] })

  assert.ok(result.goalId)
  const data = await readGoals()
  assert.equal(data.goals[0].status, 'proposed')
  assert.equal(data.goals[0].todos[0].status, 'pending')
})
