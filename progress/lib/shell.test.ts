import { test } from 'node:test'
import assert from 'node:assert/strict'
import { looksRateLimited } from './executors/shell.ts'

test('looksRateLimited: Claude weekly limit message is rate limited', () => {
  assert.equal(looksRateLimited("You've hit your weekly limit · resets 1am (Asia/Tokyo)"), true)
})

test('looksRateLimited: normal success message is not rate limited', () => {
  assert.equal(looksRateLimited('Auto executor smoke test completed.'), false)
})
