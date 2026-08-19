import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { ExecutionRun } from '@/types/execution-run'
import { detectClaudeRecoveryFromRuns } from './claude-recovery.ts'

function run(overrides: Partial<ExecutionRun>): ExecutionRun {
  return {
    runId: 'run',
    startedAt: '2026-07-20T00:00:00.000Z',
    finishedAt: '2026-07-20T00:01:00.000Z',
    targetApp: 'progress',
    targetTodoTitle: 'test',
    runStatus: 'completed',
    reviewStatus: 'not_reviewed',
    summary: '',
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: '',
    ...overrides,
  }
}

test('上限記録後のClaude成功Runを回復として検知する', () => {
  const result = detectClaudeRecoveryFromRuns([
    run({ runId: 'limited', runStatus: 'failed', fallbackReason: 'claude_rate_limited' }),
    run({
      runId: 'recovered',
      executorUsed: 'claude',
      finishedAt: '2026-07-20T01:01:00.000Z',
    }),
  ])

  assert.equal(result.status, 'recovered')
  assert.equal(result.recoveryRunId, 'recovered')
})

test('Codex成功RunはClaude回復として扱わない', () => {
  const result = detectClaudeRecoveryFromRuns([
    run({ runId: 'limited', runStatus: 'failed', errors: ['usage limit reached'] }),
    run({
      runId: 'codex',
      executorUsed: 'codex',
      finishedAt: '2026-07-20T01:01:00.000Z',
    }),
  ])

  assert.equal(result.status, 'limited')
})

test('上限より前のClaude成功Runは回復として扱わない', () => {
  const result = detectClaudeRecoveryFromRuns([
    run({ runId: 'old-success', executorUsed: 'claude' }),
    run({
      runId: 'limited',
      runStatus: 'failed',
      fallbackReason: 'claude_rate_limited',
      finishedAt: '2026-07-20T01:01:00.000Z',
    }),
  ])

  assert.equal(result.status, 'limited')
})

test('上限記録が無ければunknownを返す', () => {
  const result = detectClaudeRecoveryFromRuns([
    run({ runId: 'success', executorUsed: 'claude' }),
  ])

  assert.equal(result.status, 'unknown')
})
