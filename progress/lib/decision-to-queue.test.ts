import './test-alias.cjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveWorkItemStatus } from './auto-queue-score.ts'
import type { Approval, Epic } from './types/operations'

// 「今日の判断」→ 自動実行キューの遷移を固定するテスト。
// pending approval がある Epic は waiting_user（キュー外）、判断確定（approval が decided）で
// executable（次回自動実行の候補）へ戻る。回帰すると「判断したのにキューに入らない／
// 判断前なのに勝手に実行される」事故になるため、ここで検知する。

function epic(partial: Partial<Epic>): Epic {
  return {
    epicId: 'epic-test-1',
    title: 'テストEpic',
    goal: 'テスト用',
    progress: 10,
    remainingWork: ['残作業'],
    nextAction: '次の一歩',
    decisionPolicy: 'autonomous',
    status: 'active',
    factoryEligible: true,
    updatedAt: '2026-07-20T00:00:00.000Z',
    ...partial,
  }
}

function approval(partial: Partial<Approval>): Approval {
  return {
    approvalId: 'appr-test-1',
    epicId: 'epic-test-1',
    title: 'ブロック中の作業: テストEpic',
    priority: 'normal',
    category: 'multi_option',
    options: [
      { key: 'resolve', label: '対処して進める' },
      { key: 'cancel', label: 'この作業を中止' },
      { key: 'hold', label: '保留' },
    ],
    recommended: 'resolve',
    reason: 'テスト用の判断',
    status: 'pending',
    createdAt: '2026-07-20T00:00:00.000Z',
    ...partial,
  }
}

test('判断待ち: pending approval がある Epic は waiting_user（キューに入らない）', () => {
  const status = deriveWorkItemStatus(epic({}), { runs: [], approvals: [approval({})] })
  assert.equal(status, 'waiting_user')
})

test('判断確定: approval が decided になると executable（自動実行キューに加わる）', () => {
  const decided = approval({ status: 'decided', decidedOption: 'resolve', decidedBy: 'user' })
  const status = deriveWorkItemStatus(epic({}), { runs: [], approvals: [decided] })
  assert.equal(status, 'executable')
})

test('判断で「保留」を選択（applyApprovalEffect が queueControl.hold=true を付与）→ held でキュー外のまま', () => {
  const held = epic({ queueControl: { hold: true, updatedBy: 'user', updatedAt: '2026-07-20T00:00:00.000Z' } })
  const decided = approval({ status: 'decided', decidedOption: 'hold' })
  const status = deriveWorkItemStatus(held, { runs: [], approvals: [decided] })
  assert.equal(status, 'held')
})

test('decisionPolicy=approval_required の Epic は判断確定後も waiting_user（毎回承認が必要）', () => {
  const decided = approval({ status: 'decided', decidedOption: 'resolve' })
  const status = deriveWorkItemStatus(epic({ decisionPolicy: 'approval_required' }), { runs: [], approvals: [decided] })
  assert.equal(status, 'waiting_user')
})

test('別 Epic の pending approval は影響しない（executable のまま）', () => {
  const other = approval({ approvalId: 'appr-test-2', epicId: 'epic-other' })
  const status = deriveWorkItemStatus(epic({}), { runs: [], approvals: [other] })
  assert.equal(status, 'executable')
})
