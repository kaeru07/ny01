import { test } from 'node:test'
import assert from 'node:assert/strict'
import { failingChecks, gateRunStatusByChecks } from './checks-gate.ts'

// lint ゲートの中核（lint NG の Run を completed のまま通さない）を固定するテスト。
// 回帰すると factory 実行で lint NG のまま completed になり品質が落ちるため、ここで検知する。

test('failingChecks: lint=NG を NG として拾う', () => {
  assert.deepEqual(failingChecks({ typescript: 'OK', lint: 'NG' }), ['lint=NG'])
})

test('failingChecks: 全 OK は空配列', () => {
  assert.deepEqual(failingChecks({ typescript: 'OK', lint: 'OK', build: 'OK' }), [])
})

test('failingChecks: 複数 NG を全部拾う', () => {
  assert.deepEqual(failingChecks({ lint: 'NG', build: 'failed' }), ['lint=NG', 'build=failed'])
})

test('failingChecks: undefined / 非文字列は無視', () => {
  assert.deepEqual(failingChecks(undefined), [])
  assert.deepEqual(failingChecks({ lint: undefined }), [])
})

test('gate: lint NG の completed は partial へ格下げ', () => {
  assert.equal(gateRunStatusByChecks('completed', { lint: 'NG' }), 'partial')
})

test('gate: 全 OK の completed は completed のまま', () => {
  assert.equal(gateRunStatusByChecks('completed', { lint: 'OK', typescript: 'OK' }), 'completed')
})

test('gate: completed 以外（failed/partial/running）は checks NG でも素通し', () => {
  assert.equal(gateRunStatusByChecks('failed', { lint: 'NG' }), 'failed')
  assert.equal(gateRunStatusByChecks('partial', { lint: 'NG' }), 'partial')
  assert.equal(gateRunStatusByChecks('running', { lint: 'NG' }), 'running')
})

test('gate: checks 未指定の completed はそのまま completed', () => {
  assert.equal(gateRunStatusByChecks('completed', undefined), 'completed')
})
