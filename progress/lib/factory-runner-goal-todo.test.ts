import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { runFactory } from './factory-runner.ts'
import type { GoalsData } from '@/types/goal'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { Epic } from '@/lib/types/operations'

let dir: string
let prevDataPath: string | undefined

async function writeJson(filename: string, data: unknown): Promise<void> {
  await fs.writeFile(path.join(dir, filename), JSON.stringify(data, null, 2), 'utf-8')
}

async function readJson<T>(filename: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(dir, filename), 'utf-8')) as T
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-goal-todo-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
  await writeJson('automation-config.json', {
    executorMode: 'both',
    autoResume: false,
    autoFallback: false,
    factoryEnabled: true,
    factoryMaxPerEpic: 1,
    updatedAt: '2026-07-10T00:00:00.000Z',
  })
  await writeJson('epics.json', [])
  await writeJson('execution-runs.json', { runs: [] })
  await writeJson('approvals.json', [])
  await writeJson('skills.json', { skills: [], updatedAt: '2026-07-10T00:00:00.000Z' })
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('runFactory: キュー上位のGoalTodoをEpic化し、ExecutionRunからTodo由来を追跡できる', async () => {
  const goals: GoalsData = {
    goals: [{
      id: 'goal-factory-todo',
      projectId: 'company-mgmt',
      title: 'AI工場の作業順をProgressに集約する',
      summary: 'VaultのやることをProgressの自動実行キューに寄せる',
      target: 100,
      current: 10,
      status: 'active',
      priority: 'high',
      monetizationImpact: 'none',
      phases: [{ id: 'phase-1', title: '統合', summary: '', order: 0, status: 'in_progress' }],
      todos: [{
        id: 'todo-confirm-goal-todo-epic',
        goalId: 'goal-factory-todo',
        phaseId: 'phase-1',
        title: 'Goal内ToDoがEpic化される経路を確認する',
        role: 'claude',
        order: 0,
        priority: 'high',
        nextAction: 'Factoryを1回走らせ、生成EpicとExecutionRunを確認する',
        doneCriteria: [
          '生成Epicのtitle/goal/doneCriteriaがGoalTodo由来である',
          'ExecutionRunにtargetTodoIdが保存される',
        ],
        taskPrompt: 'GoalTodo由来のEpic生成とRun記録を検証する',
        memo: 'テスト用ToDoメモ',
        status: 'active',
        dependsOn: [],
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      }],
      createdAt: '2026-07-10T00:00:00.000Z',
      updatedAt: '2026-07-10T00:00:00.000Z',
    }],
    updatedAt: '2026-07-10T00:00:00.000Z',
  }
  await writeJson('goals.json', goals)

  const report = await runFactory({
    mode: 'auto',
    confirm: true,
    maxPerEpic: 1,
    simulateClaudeSuccessBeforeRateLimit: true,
    cwd: dir,
  })

  assert.equal(report.runsExecuted, 1)
  assert.equal(report.steps[0]?.epicId, 'epic-goalstep-goal-factory-todo')

  const epics = await readJson<Epic[]>('epics.json')
  const epic = epics.find((item) => item.epicId === 'epic-goalstep-goal-factory-todo')
  assert.ok(epic)
  assert.equal(epic.title, 'AI工場の作業順をProgressに集約する: Goal内ToDoがEpic化される経路を確認する')
  assert.match(epic.goal, /配下ToDo「Goal内ToDoがEpic化される経路を確認する」を実行する/)
  assert.match(epic.goal, /次のアクション: Factoryを1回走らせ、生成EpicとExecutionRunを確認する/)
  assert.match(epic.goal, /作業指示: GoalTodo由来のEpic生成とRun記録を検証する/)
  assert.deepEqual(epic.doneCriteria, goals.goals[0].todos[0].doneCriteria)
  assert.deepEqual(epic.relatedTodoIds, ['todo-confirm-goal-todo-epic'])
  assert.ok(epic.notes)
  assert.match(epic.notes, /GoalTodoから自動生成/)

  const runsData = await readJson<ExecutionRunsData>('execution-runs.json')
  const run = runsData.runs.find((item) => item.epicId === epic.epicId)
  assert.ok(run)
  assert.equal(run.source, 'factory_runner')
  assert.equal(run.factoryRun, true)
  assert.equal(run.targetTodoId, 'todo-confirm-goal-todo-epic')
  assert.equal(run.selection?.selectedGoalKey, 'goal-factory-todo')
  assert.equal(run.selection?.selectedWorkItemId, `epic:${epic.epicId}`)
  assert.match(run.targetTodoTitle, /Goal内ToDoがEpic化される経路を確認する/)
})
