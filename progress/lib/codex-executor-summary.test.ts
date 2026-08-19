import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeCodexResult } from './executors/shell'

test('空出力の非ゼロ終了では終了コードを要約に残す', () => {
  assert.equal(
    summarizeCodexResult('', 1, false),
    'Codexが終了コード1で終了しました（出力なし）',
  )
})

test('出力がある場合は従来どおり末尾3行を要約する', () => {
  assert.equal(summarizeCodexResult('one\ntwo\nthree\nfour\n', 1, false), 'two / three / four')
})

test('空出力のタイムアウトを終了コードより優先して記録する', () => {
  assert.equal(summarizeCodexResult('', null, true), 'Codexがタイムアウトしました（出力なし）')
})
