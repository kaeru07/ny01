import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateReviewStatusByChecks } from './checks-gate.ts'

test('checks NG は未レビューの Run を即座に要修正へ送る', () => {
  assert.equal(gateReviewStatusByChecks('not_reviewed', { lint: 'NG' }), 'needs_followup')
})

test('checks OK は既存のレビュー状態を維持する', () => {
  assert.equal(gateReviewStatusByChecks('not_reviewed', { lint: 'OK', typescript: 'OK' }), 'not_reviewed')
  assert.equal(gateReviewStatusByChecks('reviewed', undefined), 'reviewed')
})
