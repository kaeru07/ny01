import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeExecutionRunErrors } from './execution-run-errors.ts'

test('normalizeExecutionRunErrors: HTTP成功ログはerrorsから除外する', () => {
  assert.deepEqual(normalizeExecutionRunErrors([
    'script></body></html>\n succeeded in 9159ms:\nHTTP/1.1 200 OK',
  ]), [])
})

test('normalizeExecutionRunErrors: git statusとdiff断片はerrorsから除外する', () => {
  assert.deepEqual(normalizeExecutionRunErrors([
    ' M data/real/execution-runs.json\n?? data/real/factory-schedule.lock',
    'diff --git a/lib/a.ts b/lib/a.ts\nindex 111..222\n--- a/lib/a.ts\n+++ b/lib/a.ts\n@@ -1 +1 @@',
  ]), [])
})

test('normalizeExecutionRunErrors: 実際の失敗は残す', () => {
  assert.deepEqual(normalizeExecutionRunErrors([
    'TypeError: Cannot read properties of undefined',
    'HTTP/1.1 500 Internal Server Error',
  ]), [
    'TypeError: Cannot read properties of undefined',
    'HTTP/1.1 500 Internal Server Error',
  ])
})
