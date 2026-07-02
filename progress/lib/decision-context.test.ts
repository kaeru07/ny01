import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildDecisionContext } from './decision-context.ts'
import { isRetryableFailure } from './auto-queue-score.ts'
import type { ExecutionRun } from '@/types/execution-run'

async function withDataDir<T>(files: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-decision-context-'))
  const previous = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir
  try {
    await Promise.all(Object.entries(files).map(([name, data]) => (
      fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2), 'utf-8')
    )))
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previous
    await fs.rm(dir, { recursive: true, force: true })
  }
}

test('buildDecisionContext: epicId一致のdecidedを整形して含める', async () => {
  const text = await withDataDir({
    'approvals.json': [
      {
        approvalId: 'ap-1',
        epicId: 'epic-a',
        title: '実装方針',
        priority: 'normal',
        category: 'multi_option',
        options: [{ key: 'proceed', label: '進める' }],
        recommended: 'proceed',
        reason: '',
        status: 'decided',
        decidedOption: 'proceed',
        decidedAt: '2026-07-02T01:00:00.000Z',
        createdAt: '2026-07-02T00:00:00.000Z',
      },
    ],
    'execution-runs.json': { runs: [] },
  }, () => buildDecisionContext({ epicId: 'epic-a' }))

  assert.match(text, /## ユーザー決定事項/)
  assert.match(text, /- 実装方針 → 進める/)
})

test('buildDecisionContext: 該当0件なら空文字', async () => {
  const text = await withDataDir({
    'approvals.json': [
      {
        approvalId: 'ap-1',
        epicId: 'epic-other',
        title: '別Epic',
        priority: 'normal',
        category: 'multi_option',
        options: [{ key: 'hold', label: '保留' }],
        recommended: 'hold',
        reason: '',
        status: 'decided',
        decidedOption: 'hold',
        decidedAt: '2026-07-02T01:00:00.000Z',
        createdAt: '2026-07-02T00:00:00.000Z',
      },
    ],
    'execution-runs.json': { runs: [] },
  }, () => buildDecisionContext({ epicId: 'epic-a' }))

  assert.equal(text, '')
})

test('isRetryableFailure: retry_approvedを含むfailedはtrue', () => {
  const run = {
    runId: 'run-1',
    startedAt: '2026-07-02T00:00:00.000Z',
    finishedAt: '2026-07-02T00:01:00.000Z',
    targetApp: 'progress',
    targetTodoTitle: 'retry',
    runStatus: 'failed',
    reviewStatus: 'not_reviewed',
    summary: 'failed',
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: '',
    stopReason: 'run_failed / retry_approved',
  } satisfies ExecutionRun

  assert.equal(isRetryableFailure(run), true)
})
