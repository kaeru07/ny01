import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMonetizationCandidateGoalImport, mapCandidateStatusToGoalStatus } from './monetization-goal-migration.ts'
import type { MonetizationCandidate } from '@/types/monetization'

function candidate(patch: Partial<MonetizationCandidate> = {}): MonetizationCandidate {
  return {
    id: 'mc-test-001',
    name: 'テスト収益化候補',
    category: '検証',
    status: 'Candidate',
    score: 83,
    targetApp: 'test-app',
    discoveredAt: '2026-07-10T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    nextAction: '競合ASOを確認する',
    links: { vault: '05_monetization/test.md' },
    ...patch,
  }
}

test('mapCandidateStatusToGoalStatus maps candidate lifecycle to goal lifecycle', () => {
  assert.equal(mapCandidateStatusToGoalStatus('Draft'), 'proposed')
  assert.equal(mapCandidateStatusToGoalStatus('Candidate'), 'proposed')
  assert.equal(mapCandidateStatusToGoalStatus('Hold'), 'paused')
  assert.equal(mapCandidateStatusToGoalStatus('Approved'), 'active')
  assert.equal(mapCandidateStatusToGoalStatus('Rejected'), 'dropped')
  assert.equal(mapCandidateStatusToGoalStatus('Released'), 'done')
})

test('buildMonetizationCandidateGoalImport carries status and Vault reference without copying details', () => {
  const input = buildMonetizationCandidateGoalImport(candidate({ status: 'Approved' }))

  assert.equal(input.status, 'active')
  assert.equal(input.monetizationImpact, 'high')
  assert.match(input.goalSummary ?? '', /Vault詳細: 05_monetization\/test\.md/)
  assert.equal(input.todos[0].status, 'active')
  assert.match(input.todos[0].memo ?? '', /Vault詳細: 05_monetization\/test\.md/)
})
