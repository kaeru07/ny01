import './test-alias.cjs'
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { sweepDoneReadyEpics } from './factory-runner.ts'
import type { Epic } from './types/operations'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { GoalsData } from '@/types/goal'
import type { ExecutionRun } from '@/types/execution-run'

let dataDir: string
let previousDataPath: string | undefined

async function writeFixture(filename: string, data: unknown): Promise<void> {
  await fs.writeFile(path.join(dataDir, filename), JSON.stringify(data, null, 2), 'utf-8')
}

async function readFixture<T>(filename: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(dataDir, filename), 'utf-8')) as T
}

function epic(epicId: string, doneCriteria?: string[], goalId?: string): Epic {
  return {
    epicId,
    goalId,
    title: epicId,
    goal: 'テスト用Epic',
    progress: 0,
    remainingWork: [],
    nextAction: 'テストする',
    decisionPolicy: 'autonomous',
    status: 'active',
    relatedTodoIds: goalId ? [`todo-${epicId}`] : [],
    doneCriteria,
    updatedAt: '2026-08-16T00:00:00.000Z',
  }
}

function run(epicId: string, runId: string, runStatus: ExecutionRun['runStatus'], startedAt: string, reviewStatus: ExecutionRun['reviewStatus'] = 'reviewed'): ExecutionRun {
  return {
    runId, epicId, startedAt, finishedAt: startedAt, targetApp: 'progress', targetTodoTitle: epicId,
    runStatus, reviewStatus, executorUsed: 'claude', summary: '実行結果を記録した', changedFiles: [],
    checks: {}, errors: [], warnings: [], progressUpdated: false, nextActions: [], rawReport: '実行結果を記録した',
  }
}

async function writeSweepCase(epics: Epic[], runs: ExecutionRun[], approvals: unknown[] = []): Promise<void> {
  await Promise.all([
    writeFixture('epics.json', epics),
    writeFixture('execution-runs.json', { runs }),
    writeFixture('approvals.json', approvals),
    writeFixture('goals.json', { goals: [], updatedAt: '2026-08-16T00:00:00.000Z' }),
  ])
}

beforeEach(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'epic-done-sweep-test-'))
  previousDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dataDir

  const epics = [
    epic('epic-ready', ['tscが成功する', 'lib/sweep.tsを変更する', 'ExecutionRunに実行結果が記録されている'], 'goal-ready'),
    epic('epic-continue', ['未実装機能を追加する']),
    epic('epic-no-contract'),
  ]
  const goals: GoalsData = {
    goals: [{
      id: 'goal-ready',
      title: '完了伝播テスト',
      summary: 'Epic完了をGoalへ伝播する',
      target: 100,
      current: 0,
      status: 'active',
      priority: 'high',
      monetizationImpact: 'none',
      phases: [{ id: 'phase-ready', title: '実装', summary: '', order: 0, status: 'in_progress' }],
      todos: [{
        id: 'todo-epic-ready', goalId: 'goal-ready', phaseId: 'phase-ready', title: 'スイープする', role: 'claude',
        order: 0, priority: 'high', nextAction: '完了する', doneCriteria: [], taskPrompt: '', memo: '', status: 'active',
        dependsOn: [], createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z',
      }],
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    }],
    updatedAt: '2026-08-16T00:00:00.000Z',
  }
  const runs: ExecutionRunsData = { runs: [{
    runId: 'run-ready', startedAt: '2026-08-16T00:00:00.000Z', finishedAt: '2026-08-16T00:01:00.000Z',
    targetApp: 'progress', epicId: 'epic-ready', targetTodoTitle: 'スイープ', runStatus: 'completed',
    reviewStatus: 'not_reviewed', executorUsed: 'claude', summary: 'sweep.tsを変更した',
    changedFiles: [{ file: 'lib/sweep.ts', change: 'added' }], checks: { typescript: 'ok' }, errors: [], warnings: [],
    progressUpdated: false, nextActions: [], rawReport: '実装と型チェックが完了',
  }] }

  await Promise.all([
    writeFixture('epics.json', epics),
    writeFixture('goals.json', goals),
    writeFixture('execution-runs.json', runs),
    writeFixture('approvals.json', []),
  ])
})

afterEach(async () => {
  if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = previousDataPath
  await fs.rm(dataDir, { recursive: true, force: true })
})

test('done済みactive Epicだけを閉じてGoalへ伝播し、2回目は何もしない', async () => {
  const first = await sweepDoneReadyEpics()
  assert.deepEqual(first, { closedEpics: ['epic-ready'], completedGoals: ['goal-ready'], skipped: [] })

  const epics = await readFixture<Epic[]>('epics.json')
  assert.deepEqual(
    epics.map(({ epicId, status, progress }) => ({ epicId, status, progress })),
    [
      { epicId: 'epic-ready', status: 'done', progress: 100 },
      { epicId: 'epic-continue', status: 'active', progress: 0 },
      { epicId: 'epic-no-contract', status: 'active', progress: 0 },
    ],
  )
  const goal = (await readFixture<GoalsData>('goals.json')).goals[0]
  assert.equal(goal.status, 'done')
  assert.equal(goal.current, 100)
  assert.equal(goal.todos[0].status, 'done')
  assert.equal(goal.phases[0].status, 'done')

  const second = await sweepDoneReadyEpics()
  assert.deepEqual(second, { closedEpics: [], completedGoals: [], skipped: [] })
})

test('真の判断承認があるdone Epicはcloseしない', async () => {
  await writeSweepCase(
    [epic('epic-pending', ['ExecutionRunに実行結果が記録されている'])],
    [run('epic-pending', 'run-pending', 'completed', '2026-08-16T01:00:00.000Z')],
    [{ approvalId: 'approval-1', epicId: 'epic-pending', title: '実行判断', priority: 'high', category: 'production_risk', options: [{ key: 'approve', label: '承認' }, { key: 'reject', label: '却下' }], recommended: 'approve', reason: '実行可否の判断が必要です', status: 'pending', createdAt: '2026-08-16T00:00:00.000Z' }],
  )
  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result, { closedEpics: [], completedGoals: [], skipped: [{ epicId: 'epic-pending', reason: 'blocking_approval' }] })
})

test('mark_reviewed品質レビューだけなら承認を残したままcloseし、再実行も冪等', async () => {
  const approval = { approvalId: 'approval-review', epicId: 'epic-review', title: '完了作業の確認: テスト', priority: 'normal', category: 'production_risk', options: [{ key: 'mark_reviewed', label: '確認済み' }, { key: 'needs_followup', label: '追加対応' }, { key: 'hold', label: '保留' }], recommended: 'mark_reviewed', reason: '作業自体は完了済みです', status: 'pending', createdAt: '2026-08-16T00:00:00.000Z' }
  await writeSweepCase(
    [epic('epic-review', ['ExecutionRunに実行結果が記録されている'])],
    [run('epic-review', 'run-review', 'completed', '2026-08-16T01:00:00.000Z')],
    [approval],
  )

  const first = await sweepDoneReadyEpics()
  assert.deepEqual(first, { closedEpics: ['epic-review'], completedGoals: [], skipped: [] })
  assert.deepEqual(await readFixture<unknown[]>('approvals.json'), [approval])
  const second = await sweepDoneReadyEpics()
  assert.deepEqual(second, { closedEpics: [], completedGoals: [], skipped: [] })
  assert.deepEqual(await readFixture<unknown[]>('approvals.json'), [approval])
})

test('mark_reviewed確認と真の判断承認が混在すればcloseしない', async () => {
  await writeSweepCase(
    [epic('epic-mixed', ['ExecutionRunに実行結果が記録されている'])],
    [run('epic-mixed', 'run-mixed', 'completed', '2026-08-16T01:00:00.000Z')],
    [
      { approvalId: 'approval-review', epicId: 'epic-mixed', title: '完了作業の確認: テスト', priority: 'normal', category: 'production_risk', options: [{ key: 'mark_reviewed', label: '確認済み' }], recommended: 'mark_reviewed', reason: '作業自体は完了済みです', status: 'pending', createdAt: '2026-08-16T00:00:00.000Z' },
      { approvalId: 'approval-decision', epicId: 'epic-mixed', title: '公開判断', priority: 'high', category: 'external_publish', options: [{ key: 'approve', label: '承認' }, { key: 'reject', label: '却下' }], recommended: 'approve', reason: '公開可否を判断してください', status: 'pending', createdAt: '2026-08-16T00:01:00.000Z' },
    ],
  )

  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result, { closedEpics: [], completedGoals: [], skipped: [{ epicId: 'epic-mixed', reason: 'blocking_approval' }] })
})

test('最新failedはcloseせず、後続completedで解消済みの古いfailedはcloseする', async () => {
  const criterion = ['ExecutionRunに実行結果が記録されている']
  await writeSweepCase(
    [epic('epic-failed', criterion), epic('epic-recovered', criterion)],
    [
      run('epic-failed', 'run-f-ok', 'completed', '2026-08-16T01:00:00.000Z'),
      run('epic-failed', 'run-f-ng', 'failed', '2026-08-16T02:00:00.000Z'),
      run('epic-recovered', 'run-r-ng', 'failed', '2026-08-16T01:00:00.000Z'),
      run('epic-recovered', 'run-r-ok', 'completed', '2026-08-16T02:00:00.000Z'),
    ],
  )
  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result, {
    closedEpics: ['epic-recovered'], completedGoals: [],
    skipped: [{ epicId: 'epic-failed', reason: 'current_failed_run' }],
  })
})

test('blockerと最新needs_humanはcloseせず、安全なdone Epicだけcloseする', async () => {
  const criterion = ['ExecutionRunに実行結果が記録されている']
  const blocked = { ...epic('epic-blocked', criterion), blockers: ['判断待ち'] }
  await writeSweepCase(
    [blocked, epic('epic-human', criterion), epic('epic-clean', criterion)],
    [
      run('epic-blocked', 'run-blocked', 'completed', '2026-08-16T01:00:00.000Z'),
      run('epic-human', 'run-human', 'completed', '2026-08-16T01:00:00.000Z', 'needs_human'),
      run('epic-clean', 'run-clean', 'completed', '2026-08-16T01:00:00.000Z'),
    ],
  )
  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result, {
    closedEpics: ['epic-clean'], completedGoals: [],
    skipped: [
      { epicId: 'epic-blocked', reason: 'unresolved_blocker' },
      { epicId: 'epic-human', reason: 'blocking_needs_human' },
    ],
  })
})

test('1 Epicの判定例外でも後続の安全なEpicを処理する', async () => {
  const malformed = { ...epic('epic-broken'), doneCriteria: [42] } as unknown as Epic
  await writeSweepCase(
    [malformed, epic('epic-safe', ['ExecutionRunに実行結果が記録されている'])],
    [run('epic-safe', 'run-safe', 'completed', '2026-08-16T01:00:00.000Z')],
  )
  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result.closedEpics, ['epic-safe'])
  assert.equal(result.skipped[0].epicId, 'epic-broken')
  assert.match(result.skipped[0].reason, /^epic_processing_failed:/)
})

test('Goal配下に未完了Epicが残る間はGoalを完了にしない', async () => {
  const ready = epic('epic-one', ['ExecutionRunに実行結果が記録されている'], 'goal-shared')
  const remaining = epic('epic-two', ['未実装機能を追加する'], 'goal-shared')
  const goals: GoalsData = {
    goals: [{
      id: 'goal-shared', title: '共有Goal', summary: '', target: 100, current: 0, status: 'active', priority: 'high', monetizationImpact: 'none',
      phases: [], todos: [], createdAt: '2026-08-16T00:00:00.000Z', updatedAt: '2026-08-16T00:00:00.000Z',
    }], updatedAt: '2026-08-16T00:00:00.000Z',
  }
  await writeSweepCase([ready, remaining], [run('epic-one', 'run-one', 'completed', '2026-08-16T01:00:00.000Z')])
  await writeFixture('goals.json', goals)
  const result = await sweepDoneReadyEpics()
  assert.deepEqual(result, { closedEpics: ['epic-one'], completedGoals: [], skipped: [] })
  assert.equal((await readFixture<GoalsData>('goals.json')).goals[0].status, 'active')
})
