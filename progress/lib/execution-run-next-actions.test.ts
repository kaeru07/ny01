import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensureExecutionRunNextActions } from './execution-run-next-actions.ts'

test('ensureExecutionRunNextActions: explicit actions are cleaned and deduplicated', () => {
  assert.deepEqual(
    ensureExecutionRunNextActions({
      nextActions: ['- 同じ確認をする', '同じ確認をする', '  「別の作業」  '],
      runStatus: 'completed',
    }),
    ['同じ確認をする', '別の作業'],
  )
})

test('ensureExecutionRunNextActions: extracts actions from raw report headings', () => {
  assert.deepEqual(
    ensureExecutionRunNextActions({
      rawReport: ['作業完了', '次にやること:', '- 回帰テストを追加する', '- 運用手順に反映する'].join('\n'),
      runStatus: 'completed',
    }),
    ['回帰テストを追加する', '運用手順に反映する'],
  )
})

test('ensureExecutionRunNextActions: failed runs fall back to first error', () => {
  assert.deepEqual(
    ensureExecutionRunNextActions({
      runStatus: 'failed',
      errors: ['adapter timeout'],
      targetTodoTitle: 'Prompt Queue dispatch',
    }),
    ['adapter timeout'],
  )
})

test('ensureExecutionRunNextActions: completed runs always get a next step fallback', () => {
  assert.deepEqual(
    ensureExecutionRunNextActions({
      runStatus: 'completed',
      summary: 'Monetization Hub候補をEpic化',
      targetTodoTitle: 'Monetization Hub: 候補をEpic化',
    }),
    ['Monetization Hub: 候補をEpic化 の結果を確認し、未達のDoneCriteriaを1つ進める'],
  )
})
