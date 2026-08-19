import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { runFactory } from './factory-runner.ts'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { Epic } from '@/lib/types/operations'
import type { GoalsData } from '@/types/goal'

let dir: string
let prevDataPath: string | undefined

async function writeJson(filename: string, data: unknown): Promise<void> {
  await fs.writeFile(path.join(dir, filename), JSON.stringify(data, null, 2), 'utf-8')
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-lint-gate-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir

  const epic: Epic = {
    epicId: 'epic-lint-gate-integration',
    goalId: 'goal-lint-gate-integration',
    title: 'lintゲートを結合テストする',
    goal: 'Factory実行でlint NGのRunを完了扱いにしない',
    progress: 0,
    remainingWork: ['lint NG時の保存状態を検証する'],
    nextAction: '結合テストを実行する',
    decisionPolicy: 'autonomous',
    status: 'active',
    targetApp: 'company-mgmt',
    targetApps: ['company-mgmt'],
    doneCriteria: ['Factory実行が成功を返してもlint NGなら完了にしない'],
    priority: 'P0',
    riskFlags: [],
    preferredExecutor: 'claude',
    fallbackExecutor: 'codex',
    factoryEligible: true,
    updatedAt: '2026-07-20T00:00:00.000Z',
  }

  await writeJson('automation-config.json', {
    executorMode: 'both',
    autoResume: false,
    autoFallback: false,
    factoryEnabled: true,
    factoryMaxPerEpic: 1,
    updatedAt: '2026-07-20T00:00:00.000Z',
  })
  await writeJson('epics.json', [epic])
  await writeJson('execution-runs.json', { runs: [] })
  await writeJson('approvals.json', [])
  await writeJson('goals.json', {
    goals: [{
      id: 'goal-lint-gate-integration',
      projectId: 'company-mgmt',
      title: 'lintゲートを追加する',
      summary: 'lint NGのRunを完了扱いにしない',
      target: 100,
      current: 0,
      status: 'active',
      priority: 'high',
      monetizationImpact: 'none',
      phases: [],
      todos: [],
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    }],
    updatedAt: '2026-07-20T00:00:00.000Z',
  })
  await writeJson('skills.json', { skills: [], updatedAt: '2026-07-20T00:00:00.000Z' })
  await writeJson('package.json', {
    private: true,
    scripts: { lint: "node -e \"process.exit(1)\"" },
  })
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('runFactory: lint NGのExecutionRunをpartial・needs_followup・continueで保存する', async () => {
  const report = await runFactory({
    mode: 'auto',
    confirm: true,
    maxPerEpic: 1,
    simulateClaudeSuccessBeforeRateLimit: true,
    cwd: dir,
  })

  assert.equal(report.runsExecuted, 1)
  assert.match(report.steps[0]?.stopReason ?? '', /^lint_gate_blocked/)

  const runsData = JSON.parse(
    await fs.readFile(path.join(dir, 'execution-runs.json'), 'utf-8'),
  ) as ExecutionRunsData
  const run = runsData.runs.find((item) => item.epicId === 'epic-lint-gate-integration')

  assert.ok(run)
  assert.equal(run.checks.lint, 'NG')
  assert.equal(run.runStatus, 'partial')
  assert.equal(run.reviewStatus, 'needs_followup')
  assert.equal(run.doneCriteriaStatus, 'continue')
  assert.match(run.stopReason ?? '', /^lint_gate_blocked/)
  assert.ok(run.warnings.some((warning) => warning.startsWith('lintゲート: checks NG')))
  assert.ok(run.nextActions.length > 0)

  const epics = JSON.parse(
    await fs.readFile(path.join(dir, 'epics.json'), 'utf-8'),
  ) as Epic[]
  assert.equal(epics.find((item) => item.epicId === 'epic-lint-gate-integration')?.status, 'active')

  const goalsData = JSON.parse(
    await fs.readFile(path.join(dir, 'goals.json'), 'utf-8'),
  ) as GoalsData
  const goal = goalsData.goals.find((item) => item.id === 'goal-lint-gate-integration')
  assert.equal(goal?.status, 'active')
  assert.equal(goal?.current, 0)
})
