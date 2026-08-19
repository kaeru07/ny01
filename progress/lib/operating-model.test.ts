import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateOperatingModelFreshness,
  operatingModelStaleDays,
} from './operating-model.ts'

const TODAY = new Date(2026, 6, 20, 12)

test('operatingModelStaleDays: 実在する日付だけを受け付ける', () => {
  assert.equal(operatingModelStaleDays('2026-07-19', TODAY), 1)
  assert.equal(operatingModelStaleDays('2026-02-30', TODAY), -1)
  assert.equal(operatingModelStaleDays('2026/07/19', TODAY), -1)
})

test('evaluateOperatingModelFreshness: 14日未満は新鮮、14日で警告する', () => {
  assert.equal(evaluateOperatingModelFreshness('2026-07-07', null, TODAY).stale, false)
  assert.equal(evaluateOperatingModelFreshness('2026-07-06', null, TODAY).stale, true)
})

test('evaluateOperatingModelFreshness: updated当日の実装変更は乖離扱いしない', () => {
  const freshness = evaluateOperatingModelFreshness('2026-07-19', {
    file: 'lib/factory-runner.ts',
    mtime: new Date(2026, 6, 19, 23, 0),
  }, TODAY)

  assert.equal(freshness.implementationChangedAfterDoc, false)
  assert.equal(freshness.stale, false)
})

test('evaluateOperatingModelFreshness: updated翌日以降の実装変更を乖離候補として示す', () => {
  const freshness = evaluateOperatingModelFreshness('2026-07-19', {
    file: 'lib/factory-runner.ts',
    mtime: new Date(2026, 6, 20, 9, 0),
  }, TODAY)

  assert.equal(freshness.implementationChangedAfterDoc, true)
  assert.equal(freshness.stale, true)
  assert.equal(freshness.latestImplementationPath, 'lib/factory-runner.ts')
  assert.equal(freshness.latestImplementationDate, '2026-07-20')
})
