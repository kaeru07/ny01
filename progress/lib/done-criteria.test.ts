import './test-alias.cjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateDoneCriteria } from './done-criteria.ts'
import type { ExecutionRun } from '@/types/execution-run'

function run(partial: Partial<ExecutionRun>): ExecutionRun {
  return {
    runId: partial.runId ?? 'run-test',
    startedAt: partial.startedAt ?? '2026-07-07T00:00:00.000Z',
    finishedAt: partial.finishedAt ?? '2026-07-07T00:01:00.000Z',
    targetApp: partial.targetApp ?? 'progress',
    epicId: partial.epicId ?? 'epic-test',
    targetTodoTitle: partial.targetTodoTitle ?? 'test',
    runStatus: partial.runStatus ?? 'completed',
    reviewStatus: partial.reviewStatus ?? 'not_reviewed',
    executorUsed: partial.executorUsed ?? 'claude',
    summary: partial.summary ?? '',
    changedFiles: partial.changedFiles ?? [],
    checks: partial.checks ?? {},
    errors: partial.errors ?? [],
    warnings: partial.warnings ?? [],
    progressUpdated: partial.progressUpdated ?? false,
    nextActions: partial.nextActions ?? [],
    rawReport: partial.rawReport ?? '',
  }
}

test('research criteria can pass with report evidence without changedFiles', () => {
  const result = evaluateDoneCriteria('epic-test', ['failed Runの原因を調査して結果を報告する'], [
    run({
      summary: 'failed Runの調査を実施',
      rawReport: '調査結果: runStatus=failed の原因は起動コマンドの失敗。結論として再実行前に設定修正が必要。',
    }),
  ], 0)
  assert.equal(result.verdict, 'done')
})

test('research criteria does not pass by criterion self-reference only', () => {
  const criterion = 'failed Runの原因を調査して結果を報告する'
  const result = evaluateDoneCriteria('epic-test', [criterion], [
    run({
      summary: '',
      rawReport: criterion,
    }),
  ], 0)
  assert.equal(result.verdict, 'continue')
})

test('implementation criteria still require changedFiles', () => {
  const result = evaluateDoneCriteria('epic-test', ['Queue complete/prioritizeを実装する'], [
    run({
      summary: 'Queue complete/prioritizeを実装する',
      rawReport: 'Queue complete/prioritizeを実装する',
      changedFiles: [],
    }),
  ], 0)
  assert.equal(result.verdict, 'continue')
})
