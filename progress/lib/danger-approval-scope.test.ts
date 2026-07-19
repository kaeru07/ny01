import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesDangerBlockedScope,
  resolveDangerApprovalScope,
  summarizeDangerApprovalScopes,
} from './danger-approval-scope.ts'
import type { Approval, Epic } from './types/operations.ts'
import type { ExecutionRun } from '../types/execution-run.ts'
import type { Goal } from '../types/goal.ts'

function approval(patch: Partial<Approval>): Approval {
  return {
    approvalId: 'appr-1',
    title: '危険判断',
    priority: 'normal',
    category: 'secret',
    options: [{ key: 'allow', label: '許可する' }, { key: 'deny', label: '許可しない' }],
    recommended: 'deny',
    reason: '確認してください',
    status: 'pending',
    createdAt: '2026-07-19T00:00:00.000Z',
    ...patch,
  }
}

const epics: Pick<Epic, 'epicId' | 'goalId'>[] = [
  { epicId: 'epic-a', goalId: 'goal-a' },
  { epicId: 'epic-b' },
]
const goals: Pick<Goal, 'id' | 'projectId'>[] = [
  { id: 'goal-a', projectId: 'project-a' },
]
const runs: Pick<ExecutionRun, 'runId' | 'targetApp'>[] = [
  { runId: '20260719-120000', targetApp: 'project-run' },
]

test('resolveDangerApprovalScope: approval projectId wins', () => {
  const scope = resolveDangerApprovalScope(approval({ approvalId: 'appr-project', projectId: 'project-direct' }), { epics, goals, runs })
  assert.equal(scope?.projectId, 'project-direct')
  assert.equal(scope?.source, 'approval_project')
})

test('resolveDangerApprovalScope: epic resolves goal and project', () => {
  const scope = resolveDangerApprovalScope(approval({ approvalId: 'appr-epic', epicId: 'epic-a' }), { epics, goals, runs })
  assert.equal(scope?.epicId, 'epic-a')
  assert.equal(scope?.goalId, 'goal-a')
  assert.equal(scope?.projectId, 'project-a')
})

test('resolveDangerApprovalScope: createdRunId falls back to targetApp', () => {
  const scope = resolveDangerApprovalScope(approval({ approvalId: 'appr-run', createdRunId: '20260719-120000' }), { epics, goals, runs })
  assert.equal(scope?.projectId, 'project-run')
  assert.equal(scope?.source, 'run_target_app')
})

test('summarizeDangerApprovalScopes: unscoped approval triggers safety fallback', () => {
  const summary = summarizeDangerApprovalScopes([
    approval({ approvalId: 'appr-scoped', epicId: 'epic-a' }),
    approval({ approvalId: 'appr-unscoped' }),
  ], { epics, goals, runs })

  assert.equal(summary.scoped.length, 1)
  assert.equal(summary.unscoped.map((item) => item.approvalId).join(','), 'appr-unscoped')
})

test('matchesDangerBlockedScope: project scope blocks project descendants only', () => {
  const summary = summarizeDangerApprovalScopes([
    approval({ approvalId: 'appr-project', projectId: 'project-a' }),
  ], { epics, goals, runs })

  assert.equal(matchesDangerBlockedScope({ epicId: 'epic-a' }, summary, { epics, goals }), true)
  assert.equal(matchesDangerBlockedScope({ projectId: 'project-other' }, summary, { epics, goals }), false)
})
