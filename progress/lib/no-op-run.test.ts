import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyNoOpRun } from './no-op-run'

function result(overrides: Partial<Parameters<typeof classifyNoOpRun>[0]> = {}) {
  return {
    status: 'completed' as const,
    stdout: '',
    resultSummary: '',
    changedFiles: [] as string[],
    ...overrides,
  }
}

test('変更0かつ出力なしの Run は空振りと判定する', () => {
  // 実例: runId 20260822-160657-718（executor=claude / summary=「（出力なし）」）が
  // completed 扱いになり、作業予約まで完了になっていた
  assert.equal(classifyNoOpRun(result()).isNoOp, true)
  assert.equal(classifyNoOpRun(result({ resultSummary: '（出力なし）' })).isNoOp, true)
  assert.equal(classifyNoOpRun(result({ resultSummary: 'no output' })).isNoOp, true)
  assert.match(classifyNoOpRun(result({ resultSummary: '（出力なし）' })).reason, /変更ファイル0件/)
})

test('変更ファイルか出力があれば空振りにしない', () => {
  assert.equal(classifyNoOpRun(result({ changedFiles: ['lib/x.ts'] })).isNoOp, false)
  assert.equal(classifyNoOpRun(result({ stdout: '修正しました' })).isNoOp, false)
  assert.equal(classifyNoOpRun(result({ resultSummary: '調査して3本記録した' })).isNoOp, false)
})

test('失敗は空振り扱いにしない（失敗として別経路で処理する）', () => {
  assert.equal(classifyNoOpRun(result({ status: 'failed' })).isNoOp, false)
  assert.equal(classifyNoOpRun(result({ status: 'failed', resultSummary: '（出力なし）' })).isNoOp, false)
})

test('空白だけの出力は出力なしとして扱う', () => {
  assert.equal(classifyNoOpRun(result({ stdout: '   \n  ' })).isNoOp, true)
})
