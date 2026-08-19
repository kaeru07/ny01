import './test-alias.cjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { hasReachedMaxPerEpic, resolveMaxPerEpic, runFactory } from './factory-runner.ts'
import { POST as postFactoryRun } from '../app/api/operations/factory-run/route.ts'
import { POST as postAutomationConfig } from '../app/api/operations/automation-config/route.ts'
import type { Epic } from './types/operations.ts'
import type { FactoryRunReport } from './executors/types.ts'
import type { GoalsData } from '../types/goal.ts'

test('resolveMaxPerEpic: 未指定時は複数Epicを回す既定1を使う', () => {
  assert.equal(resolveMaxPerEpic(), 1)
})

test('resolveMaxPerEpic: 保存設定を1〜3の範囲で使う', () => {
  assert.equal(resolveMaxPerEpic(undefined, 1), 1)
  assert.equal(resolveMaxPerEpic(undefined, 2), 2)
  assert.equal(resolveMaxPerEpic(undefined, 3), 3)
})

test('resolveMaxPerEpic: 実行時指定を保存設定より優先する', () => {
  assert.equal(resolveMaxPerEpic(1, 3), 1)
  assert.equal(resolveMaxPerEpic(3, 1), 3)
})

test('resolveMaxPerEpic: 範囲外・小数・非有限値を安全に正規化する', () => {
  assert.equal(resolveMaxPerEpic(0, 2), 1)
  assert.equal(resolveMaxPerEpic(9, 2), 3)
  assert.equal(resolveMaxPerEpic(2.9, 1), 2)
  assert.equal(resolveMaxPerEpic(undefined, 0), 1)
  assert.equal(resolveMaxPerEpic(undefined, 9), 3)
  assert.equal(resolveMaxPerEpic(Number.NaN, 1), 1)
  assert.equal(resolveMaxPerEpic(Number.POSITIVE_INFINITY, 2), 2)
  assert.equal(resolveMaxPerEpic(undefined, Number.NaN), 1)
})

test('maxPerEpic=1: 1 Run後に同一Epicを除外して次Epicへローテーションする', () => {
  const candidates = ['epic-a', 'epic-b', 'epic-c']
  const excluded = new Set<string>()
  const visited: string[] = []

  let current = candidates[0]
  let perEpic = 0
  while (current) {
    visited.push(current)
    perEpic += 1
    if (!hasReachedMaxPerEpic(perEpic, 1)) continue

    excluded.add(current)
    current = candidates.find((epicId) => !excluded.has(epicId)) ?? ''
    perEpic = 0
  }

  assert.deepEqual(visited, ['epic-a', 'epic-b', 'epic-c'])
  assert.deepEqual(Array.from(excluded), ['epic-a', 'epic-b', 'epic-c'])
})

test('maxPerEpic=3: 上限までは同一Epicを継続する', () => {
  assert.equal(hasReachedMaxPerEpic(1, 3), false)
  assert.equal(hasReachedMaxPerEpic(2, 3), false)
  assert.equal(hasReachedMaxPerEpic(3, 3), true)
})

test('maxPerEpic=2: 2 Runごとに次のEpicへローテーションする', () => {
  const candidates = ['epic-a', 'epic-b']
  const excluded = new Set<string>()
  const visited: string[] = []

  let current = candidates[0]
  let perEpic = 0
  while (current) {
    visited.push(current)
    perEpic += 1
    if (!hasReachedMaxPerEpic(perEpic, 2)) continue

    excluded.add(current)
    current = candidates.find((epicId) => !excluded.has(epicId)) ?? ''
    perEpic = 0
  }

  assert.deepEqual(visited, ['epic-a', 'epic-a', 'epic-b', 'epic-b'])
  assert.deepEqual(Array.from(excluded), ['epic-a', 'epic-b'])
})

test('runFactory: 保存したfactoryMaxPerEpicを実行レポートへ反映する', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-max-per-epic-'))
  const previousDataPath = process.env.PROGRESS_DATA_PATH

  try {
    process.env.PROGRESS_DATA_PATH = dataDir
    await fs.writeFile(
      path.join(dataDir, 'automation-config.json'),
      JSON.stringify({ factoryEnabled: false, factoryMaxPerEpic: 1 }),
      'utf-8',
    )

    const report = await runFactory({ mode: 'dry_run' })

    assert.equal(report.stoppedReason, 'factory_off')
    assert.equal(report.maxPerEpic, 1)
  } finally {
    if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previousDataPath
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('runFactory: 設定ファイル未作成でも既定1を実行レポートへ反映する', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-max-per-epic-default-'))
  const previousDataPath = process.env.PROGRESS_DATA_PATH

  try {
    process.env.PROGRESS_DATA_PATH = dataDir

    const report = await runFactory({ mode: 'dry_run' })

    assert.equal(report.stoppedReason, 'factory_off')
    assert.equal(report.maxPerEpic, 1)
  } finally {
    if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previousDataPath
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('設定APIで保存した深掘り回数1を、未指定のdry-run APIがレポートへ反映する', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-max-per-epic-api-'))
  const previousDataPath = process.env.PROGRESS_DATA_PATH

  try {
    process.env.PROGRESS_DATA_PATH = dataDir
    const configResponse = await postAutomationConfig(new Request('http://localhost/api/operations/automation-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ factoryEnabled: false, factoryMaxPerEpic: 1 }),
    }))
    const savedConfig = await configResponse.json()

    const response = await postFactoryRun(new Request('http://localhost/api/operations/factory-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'dry_run' }),
    }))
    const report = await response.json() as FactoryRunReport

    assert.equal(configResponse.status, 200)
    assert.equal(savedConfig.factoryMaxPerEpic, 1)
    assert.equal(response.status, 200)
    assert.equal(report.stoppedReason, 'factory_off')
    assert.equal(report.maxPerEpic, 1)
  } finally {
    if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previousDataPath
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('factory-schedule: 未指定値をrunnerへ渡し、保存設定の採用結果を返却・記録する', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'lib/factory-schedule.ts'), 'utf-8')

  // schedule 側で既定値3を再注入すると、Automation Config の選択が無効になる。
  // undefined のまま runner へ渡し、runner が保存値を解決する契約を固定する。
  assert.match(source, /maxPerEpic: input\.maxPerEpic/)
  assert.doesNotMatch(source, /maxPerEpic:\s*input\.maxPerEpic\s*\?\?\s*3/)
  assert.match(source, /maxPerEpic: report\.maxPerEpic/)
  assert.match(source, /maxPerEpic=\$\{report\.maxPerEpic\}/)
})

test('factory-schedule API: maxPerEpic未指定時は保存設定の解決をrunnerへ委譲する', async () => {
  const source = await fs.readFile(
    path.join(process.cwd(), 'app/api/operations/factory-schedule/route.ts'),
    'utf-8',
  )

  assert.match(source, /maxPerEpic:\s*typeof body\?\.maxPerEpic === 'number' \? body\.maxPerEpic : undefined/)
  assert.doesNotMatch(source, /maxPerEpic:\s*[^\n]*\?\?\s*3/)
})

test('factory-schedule: 早期終了でも解決済みの深掘り回数を結果へ返す', async () => {
  const source = await fs.readFile(path.join(process.cwd(), 'lib/factory-schedule.ts'), 'utf-8')

  assert.match(
    source,
    /const configuredMaxPerEpic = resolveMaxPerEpic\(input\.maxPerEpic, config\.factoryMaxPerEpic\)/,
  )
  assert.match(
    source,
    /skipReason: 'factory_off',[\s\S]{0,100}maxPerEpic: configuredMaxPerEpic/,
  )
  assert.match(
    source,
    /skipReason: 'already_running',[\s\S]{0,100}maxPerEpic: configuredMaxPerEpic/,
  )
})

test('max_per_epic_reached: Factory全体の停止ではなく次Epicへの切替と表示する', async () => {
  const [activity, outlook] = await Promise.all([
    fs.readFile(path.join(process.cwd(), 'app/activity/page.tsx'), 'utf-8'),
    fs.readFile(path.join(process.cwd(), 'lib/factory-outlook.ts'), 'utf-8'),
  ])

  assert.match(activity, /max_per_epic_reached[\s\S]{0,100}次のEpicへ切替/)
  assert.match(outlook, /max_per_epic[\s\S]{0,150}次のEpicへ切り替えました/)
  assert.doesNotMatch(activity, /max_per_epic_reached\|safety_run_limit_reached/)
  assert.doesNotMatch(outlook, /safety_run_limit_reached\|max_runs_reached\|max_per_epic/)
})

test('factory-run API: 起動時指定を保存値より優先し、保存設定は変更しない', async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-max-per-epic-override-'))
  const previousDataPath = process.env.PROGRESS_DATA_PATH

  try {
    process.env.PROGRESS_DATA_PATH = dataDir
    await fs.writeFile(
      path.join(dataDir, 'automation-config.json'),
      JSON.stringify({ factoryEnabled: false, factoryMaxPerEpic: 3 }),
      'utf-8',
    )

    const response = await postFactoryRun(new Request('http://localhost/api/operations/factory-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'dry_run', maxPerEpic: 1 }),
    }))
    const report = await response.json()
    const stored = JSON.parse(await fs.readFile(path.join(dataDir, 'automation-config.json'), 'utf-8'))

    assert.equal(response.status, 200)
    assert.equal(report.maxPerEpic, 1)
    assert.equal(stored.factoryMaxPerEpic, 3)
  } finally {
    if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previousDataPath
    await fs.rm(dataDir, { recursive: true, force: true })
  }
})

test('factory-run API: 保存値に応じた回数だけ各Epicを実行してローテーションする', async (t) => {
  for (const testCase of [
    { maxPerEpic: 1, expectedEpicIds: ['epic-rotation-a', 'epic-rotation-b'] },
    { maxPerEpic: 2, expectedEpicIds: ['epic-rotation-a', 'epic-rotation-a', 'epic-rotation-b', 'epic-rotation-b'] },
    { maxPerEpic: 3, expectedEpicIds: [
      'epic-rotation-a', 'epic-rotation-a', 'epic-rotation-a',
      'epic-rotation-b', 'epic-rotation-b', 'epic-rotation-b',
    ] },
  ]) await t.test(`maxPerEpic=${testCase.maxPerEpic}`, async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'factory-max-per-epic-rotation-'))
  const previousDataPath = process.env.PROGRESS_DATA_PATH
  const now = '2026-08-10T00:00:00.000Z'
  const epics: Epic[] = ['a', 'b'].map((suffix) => ({
    epicId: `epic-rotation-${suffix}`,
    goalId: `goal-rotation-${suffix}`,
    title: `ローテーション対象${suffix.toUpperCase()}`,
    goal: '同じEpicを連続実行せず、異なる作業を進める',
    progress: 0,
    remainingWork: ['次の具体的な1ステップを進める'],
    nextAction: 'Factoryで1 Run実行する',
    decisionPolicy: 'autonomous',
    status: 'active',
    targetApp: 'company-mgmt',
    targetApps: ['company-mgmt'],
    doneCriteria: ['次のステップを定義する'],
    priority: 'P1',
    riskFlags: [],
    preferredExecutor: 'claude',
    fallbackExecutor: 'codex',
    factoryEligible: true,
    updatedAt: now,
  }))
  const goals: GoalsData = {
    goals: ['a', 'b'].map((suffix) => ({
      id: `goal-rotation-${suffix}`,
      projectId: 'company-mgmt',
      title: `ローテーションGoal ${suffix.toUpperCase()}`,
      summary: '複数の異なるタスクを1サイクルで進める',
      target: 100,
      current: 0,
      status: 'active',
      priority: 'high',
      monetizationImpact: 'none',
      phases: [],
      todos: [],
      createdAt: now,
      updatedAt: now,
    })),
    updatedAt: now,
  }

  try {
    process.env.PROGRESS_DATA_PATH = dataDir
    await Promise.all([
      fs.writeFile(path.join(dataDir, 'epics.json'), JSON.stringify(epics)),
      fs.writeFile(path.join(dataDir, 'goals.json'), JSON.stringify(goals)),
      fs.writeFile(path.join(dataDir, 'execution-runs.json'), JSON.stringify({ runs: [] })),
      fs.writeFile(path.join(dataDir, 'approvals.json'), JSON.stringify([])),
      fs.writeFile(path.join(dataDir, 'skills.json'), JSON.stringify({ skills: [], updatedAt: now })),
      fs.writeFile(path.join(dataDir, 'package.json'), JSON.stringify({
        private: true,
        scripts: {
          typecheck: "node -e \"process.exit(0)\"",
          lint: "node -e \"process.exit(0)\"",
        },
      })),
    ])

    const configResponse = await postAutomationConfig(new Request('http://localhost/api/operations/automation-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executorMode: 'both',
        autoResume: false,
        autoFallback: false,
        factoryEnabled: true,
        factoryMaxPerEpic: testCase.maxPerEpic,
      }),
    }))
    assert.equal(configResponse.status, 200)
    const savedConfig = await configResponse.json()
    assert.equal(savedConfig.factoryMaxPerEpic, testCase.maxPerEpic)

    const response = await postFactoryRun(new Request('http://localhost/api/operations/factory-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'auto',
        confirm: true,
        simulateClaudeSuccessBeforeRateLimit: true,
        cwd: dataDir,
      }),
    }))
    assert.equal(response.status, 200)
    const report = await response.json() as FactoryRunReport
    const executedEpicIds = report.steps
      .filter((step) => step.recordedRunId)
      .map((step) => step.epicId)
    const persistedRuns = JSON.parse(
      await fs.readFile(path.join(dataDir, 'execution-runs.json'), 'utf-8'),
    ) as { runs: Array<{ epicId?: string }> }
    const persistedEpicIds = persistedRuns.runs.map((run) => run.epicId)

    assert.equal(report.maxPerEpic, testCase.maxPerEpic)
    assert.equal(report.runsExecuted, testCase.expectedEpicIds.length)
    assert.equal(report.stoppedReason, 'all_epics_done')
    assert.deepEqual(executedEpicIds, testCase.expectedEpicIds)
    assert.deepEqual(persistedEpicIds, testCase.expectedEpicIds)
    assert.deepEqual(
      report.steps.map((step) => ({
        epicId: step.epicId,
        kind: step.recordedRunId ? 'run' : step.stopReason?.startsWith('max_per_epic_reached') ? 'rotate' : 'other',
      })),
      testCase.expectedEpicIds.flatMap((epicId, index, all) => {
        const isLastRunForEpic = all[index + 1] !== epicId
        return isLastRunForEpic
          ? [{ epicId, kind: 'run' }, { epicId, kind: 'rotate' }]
          : [{ epicId, kind: 'run' }]
      }),
    )
  } finally {
    if (previousDataPath === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previousDataPath
    await fs.rm(dataDir, { recursive: true, force: true })
  }
  })
})
