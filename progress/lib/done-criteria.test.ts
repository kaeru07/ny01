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

const goalStepCriteria = [
  'このGoalの達成に向けた、次の具体的で検証可能な1ステップを定義する',
  '定義したステップを実装し、tscまたはbuildが成功する',
  'ExecutionRunに実行結果が記録されている',
]

test('goal-stepの汎用3criteriaはexecutor付き変更runでdoneになる', () => {
  const result = evaluateDoneCriteria('epic-goal-step', goalStepCriteria, [
    run({
      epicId: 'epic-goal-step',
      summary: '次のステップとしてdone criteria判定を実装した',
      changedFiles: [{ file: 'lib/done-criteria.ts', change: 'modified' }],
      checks: { typescript: 'ok' },
      executorUsed: 'codex',
    }),
  ], 0)

  assert.equal(result.verdict, 'done')
  assert.equal(result.ratio, '3/3')
  assert.equal(result.criteria[0].level, 'meta')
})

test('goal-stepの計画criterionはrunなし・成果なしならcontinueになる', () => {
  const withoutRun = evaluateDoneCriteria('epic-goal-step', goalStepCriteria, [], 0)
  assert.equal(withoutRun.verdict, 'continue')

  const withoutOutcome = evaluateDoneCriteria('epic-goal-step', goalStepCriteria, [
    run({ epicId: 'epic-goal-step', changedFiles: [], checks: { typescript: 'ok' } }),
  ], 0)
  assert.equal(withoutOutcome.verdict, 'continue')
  assert.equal(withoutOutcome.criteria[0].met, false)
})
