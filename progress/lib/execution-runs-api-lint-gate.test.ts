import './test-alias.cjs'
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/execution-runs/route'
import { PATCH } from '@/app/api/execution-runs/[runId]/route'
import type { ExecutionRunsData } from '@/types/execution-run'

let dir: string
let prevDataPath: string | undefined

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'execution-runs-api-lint-gate-test-'))
  prevDataPath = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
  await fs.writeFile(path.join(dir, 'epics.json'), JSON.stringify([{
    epicId: 'epic-api-lint-gate-test',
    goalId: 'goal-api-lint-gate-test',
    title: 'APIのlintゲートを検証する',
    goal: 'lint NGのRunでEpicを完了させない',
    progress: 0,
    remainingWork: ['API登録経路を検証する'],
    nextAction: '結合テストを実行する',
    decisionPolicy: 'autonomous',
    status: 'active',
    targetApp: 'company-mgmt',
    targetApps: ['company-mgmt'],
    doneCriteria: ['lint NG時は継続する'],
    priority: 'P0',
    riskFlags: [],
    factoryEligible: true,
    updatedAt: '2026-07-20T00:00:00.000Z',
  }]), 'utf-8')
  await fs.writeFile(path.join(dir, 'execution-runs.json'), JSON.stringify({ runs: [] }), 'utf-8')
  await fs.writeFile(path.join(dir, 'knowledge-records.json'), JSON.stringify([{
    id: 'knowledge-api-lint-gate-test',
    sourceRunId: 'api-lint-gate-test-run',
    nextEpicCandidateId: 'recommendation-api-lint-gate-test',
  }]), 'utf-8')
})

afterEach(async () => {
  if (prevDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
  else process.env.PROGRESS_DATA_PATH = prevDataPath
  await fs.rm(dir, { recursive: true, force: true })
})

test('POST /api/execution-runs: lint NGのcompletedをpartial・needs_followupで保存する', async () => {
  const request = new Request('http://localhost/api/execution-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      runId: 'api-lint-gate-test-run',
      targetApp: 'company-mgmt',
      epicId: 'epic-api-lint-gate-test',
      targetTodoTitle: 'lintゲートを検証する',
      runStatus: 'completed',
      doneCriteriaStatus: 'done',
      reviewStatus: 'not_reviewed',
      summary: 'API経由のlintゲートを検証した',
      rawReport: 'lint NGを検出',
      checks: { typescript: 'OK', lint: 'NG' },
      warnings: [],
      errors: [],
      nextActions: [],
    }),
  })

  const response = await POST(request)
  const body = await response.json() as { success?: boolean; runStatus?: string; lintGate?: string; epicCompleted?: boolean }

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.runStatus, 'partial')
  assert.match(body.lintGate ?? '', /lint=NG/)
  assert.equal(body.epicCompleted, undefined)

  const data = JSON.parse(
    await fs.readFile(path.join(dir, 'execution-runs.json'), 'utf-8'),
  ) as ExecutionRunsData
  const run = data.runs.find((item) => item.runId === 'api-lint-gate-test-run')

  assert.ok(run)
  assert.equal(run.runStatus, 'partial')
  assert.equal(run.reviewStatus, 'needs_followup')
  assert.equal(run.stopReason, 'lint_gate_partial')
  assert.ok(run.warnings.some((warning) => warning.startsWith('lintゲート: checks NG')))
  assert.ok(run.nextActions.length > 0)

  const epics = JSON.parse(await fs.readFile(path.join(dir, 'epics.json'), 'utf-8')) as Array<{
    epicId: string
    status: string
    progress: number
  }>
  const epic = epics.find((item) => item.epicId === 'epic-api-lint-gate-test')
  assert.equal(epic?.status, 'active')
  assert.equal(epic?.progress, 0)
})

test('PATCH /api/execution-runs/[runId]: lint NGのRunはreviewed指定でもneeds_followupを維持する', async () => {
  const createResponse = await POST(new Request('http://localhost/api/execution-runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      runId: 'api-lint-gate-test-run',
      targetApp: 'company-mgmt',
      epicId: 'epic-api-lint-gate-test',
      targetTodoTitle: 'lintゲートを検証する',
      runStatus: 'completed',
      doneCriteriaStatus: 'done',
      reviewStatus: 'not_reviewed',
      summary: 'API経由のlintゲートを検証した',
      rawReport: 'lint NGを検出',
      checks: { typescript: 'OK', lint: 'NG' },
      warnings: [],
      errors: [],
      nextActions: [],
    }),
  }))
  assert.equal(createResponse.status, 200)

  const reviewResponse = await PATCH(new NextRequest('http://localhost/api/execution-runs/api-lint-gate-test-run', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reviewStatus: 'reviewed' }),
  }), { params: { runId: 'api-lint-gate-test-run' } })
  const reviewBody = await reviewResponse.json() as { success?: boolean; epicFinalize?: unknown }

  assert.equal(reviewResponse.status, 200)
  assert.equal(reviewBody.success, true)
  assert.equal(reviewBody.epicFinalize, null)

  const runs = JSON.parse(
    await fs.readFile(path.join(dir, 'execution-runs.json'), 'utf-8'),
  ) as ExecutionRunsData
  const run = runs.runs.find((item) => item.runId === 'api-lint-gate-test-run')
  assert.equal(run?.runStatus, 'partial')
  assert.equal(run?.reviewStatus, 'needs_followup')
  assert.equal(run?.checks.lint, 'NG')

  const epics = JSON.parse(await fs.readFile(path.join(dir, 'epics.json'), 'utf-8')) as Array<{
    epicId: string
    status: string
    progress: number
  }>
  const epic = epics.find((item) => item.epicId === 'epic-api-lint-gate-test')
  assert.equal(epic?.status, 'active')
  assert.equal(epic?.progress, 0)
})
