import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSkillMaintenanceCandidates } from './skill-maintenance.ts'
import type { Skill } from './types/skill.ts'
import type { ExecutionRun } from '@/types/execution-run'

function skill(id: string): Skill {
  return {
    id,
    name: id,
    inputs: [],
    outputs: [],
    riskFlags: [],
    version: 1,
    enabled: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  }
}

function run(partial: Partial<ExecutionRun> & { runId: string; skillId: string; startedAt: string }): ExecutionRun {
  return {
    runId: partial.runId,
    startedAt: partial.startedAt,
    finishedAt: partial.finishedAt ?? partial.startedAt,
    targetApp: 'progress',
    skillId: partial.skillId,
    targetTodoTitle: 'test',
    runStatus: partial.runStatus ?? 'completed',
    reviewStatus: partial.reviewStatus ?? 'reviewed',
    summary: '',
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: '',
  }
}

test('buildSkillMaintenanceCandidates: failed率30%以上かつ母数3以上で候補を生成する', () => {
  const candidates = buildSkillMaintenanceCandidates({
    skills: [skill('skill-a')],
    runs: [
      run({ runId: 'r1', skillId: 'skill-a', startedAt: '2026-07-02T00:00:00.000Z', runStatus: 'failed' }),
      run({ runId: 'r2', skillId: 'skill-a', startedAt: '2026-07-01T00:00:00.000Z' }),
      run({ runId: 'r3', skillId: 'skill-a', startedAt: '2026-06-30T00:00:00.000Z' }),
    ],
    existingCandidates: [],
    now: new Date('2026-07-03T00:00:00.000Z'),
  })

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].skillId, 'skill-a')
  assert.match(candidates[0].reason, /failed率/)
  assert.deepEqual(candidates[0].evidence, ['r1'])
})

test('buildSkillMaintenanceCandidates: needs_followup直近3run連続で候補を生成する', () => {
  const candidates = buildSkillMaintenanceCandidates({
    skills: [skill('skill-b')],
    runs: [
      run({ runId: 'r1', skillId: 'skill-b', startedAt: '2026-07-02T00:00:00.000Z', reviewStatus: 'needs_followup' }),
      run({ runId: 'r2', skillId: 'skill-b', startedAt: '2026-07-01T00:00:00.000Z', reviewStatus: 'needs_followup' }),
      run({ runId: 'r3', skillId: 'skill-b', startedAt: '2026-06-30T00:00:00.000Z', reviewStatus: 'needs_followup' }),
    ],
    existingCandidates: [],
    now: new Date('2026-07-03T00:00:00.000Z'),
  })

  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].id, 'skillcand-2026-07-03-skill-b-needs-followup-3')
  assert.deepEqual(candidates[0].evidence, ['r1', 'r2', 'r3'])
})
