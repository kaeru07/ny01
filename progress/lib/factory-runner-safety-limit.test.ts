import './test-alias.cjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasReachedSafetyRunLimit, resolveSafetyRunLimit } from './factory-runner.ts'

test('resolveSafetyRunLimit: 未設定や無効値は0（無制限）として扱う', () => {
  assert.equal(resolveSafetyRunLimit(undefined), 0)
  assert.equal(resolveSafetyRunLimit('0'), 0)
  assert.equal(resolveSafetyRunLimit('-1'), 0)
  assert.equal(resolveSafetyRunLimit('invalid'), 0)
})

test('resolveSafetyRunLimit: 正の数だけを整数の上限として扱う', () => {
  assert.equal(resolveSafetyRunLimit('3'), 3)
  assert.equal(resolveSafetyRunLimit('3.9'), 3)
})

test('hasReachedSafetyRunLimit: 無制限時は実行件数にかかわらず打ち切らない', () => {
  assert.equal(hasReachedSafetyRunLimit(0, 0), false)
  assert.equal(hasReachedSafetyRunLimit(3, 0), false)
  assert.equal(hasReachedSafetyRunLimit(Number.MAX_SAFE_INTEGER, 0), false)
})

test('hasReachedSafetyRunLimit: 上限設定時だけ到達件数で打ち切る', () => {
  assert.equal(hasReachedSafetyRunLimit(2, 3), false)
  assert.equal(hasReachedSafetyRunLimit(3, 3), true)
  assert.equal(hasReachedSafetyRunLimit(4, 3), true)
})
