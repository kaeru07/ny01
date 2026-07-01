import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decideCodexFallback } from './executor-fallback.ts'

test('decideCodexFallback: Claude rate limit + fallback enabled + Codex eligible triggers handoff', () => {
  assert.deepEqual(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: true },
      autoFallback: true,
      executorMode: 'both',
      canRunOnCodex: true,
    }),
    { shouldFallback: true, reason: 'claude_rate_limited' },
  )
})

test('decideCodexFallback: normal Claude failure does not handoff', () => {
  assert.equal(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: false },
      autoFallback: true,
      executorMode: 'both',
      canRunOnCodex: true,
    }).shouldFallback,
    false,
  )
})

test('decideCodexFallback: autoFallback config gates Codex handoff', () => {
  assert.deepEqual(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: true },
      autoFallback: false,
      executorMode: 'both',
      canRunOnCodex: true,
    }),
    { shouldFallback: false, reason: 'auto_fallback_disabled' },
  )
})

test('decideCodexFallback: claude-only executor mode blocks handoff', () => {
  assert.deepEqual(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: true },
      autoFallback: true,
      executorMode: 'claude',
      canRunOnCodex: true,
    }),
    { shouldFallback: false, reason: 'executor_mode_claude' },
  )
})

test('decideCodexFallback: Claude-only work blocks handoff', () => {
  assert.deepEqual(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: true },
      autoFallback: true,
      executorMode: 'both',
      canRunOnCodex: true,
      requiresClaude: true,
    }),
    { shouldFallback: false, reason: 'requires_claude' },
  )
})

test('decideCodexFallback: Codex-ineligible work blocks handoff', () => {
  assert.deepEqual(
    decideCodexFallback({
      attemptedExecutor: 'claude',
      result: { rateLimited: true },
      autoFallback: true,
      executorMode: 'codex',
      canRunOnCodex: false,
    }),
    { shouldFallback: false, reason: 'codex_not_allowed_for_work' },
  )
})
