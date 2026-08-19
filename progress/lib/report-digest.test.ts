import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportDigestFromData,
  formatAchievementText,
  isNoopRun,
} from './report-digest.ts'
import type { AutoQueueView } from '@/types/auto-queue'
import type { ExecutionRun } from '@/types/execution-run'
import type { GoalsData } from '@/types/goal'

function run(patch: Partial<ExecutionRun>): ExecutionRun {
  return {
    runId: patch.runId ?? 'run-1',
    startedAt: patch.startedAt ?? '2026-07-02T23:30:00.000Z',
    finishedAt: patch.finishedAt ?? '2026-07-02T23:40:00.000Z',
    targetApp: patch.targetApp ?? 'progress',
    targetTodoTitle: patch.targetTodoTitle ?? 'テスト作業',
    runStatus: patch.runStatus ?? 'completed',
    reviewStatus: patch.reviewStatus ?? 'not_reviewed',
    summary: patch.summary ?? '設定画面の保存導線を改善',
    changedFiles: patch.changedFiles ?? [{ file: 'app/settings/page.tsx', change: '保存導線を改善' }],
    checks: patch.checks ?? {},
    errors: patch.errors ?? [],
    warnings: patch.warnings ?? [],
    progressUpdated: patch.progressUpdated ?? false,
    nextActions: patch.nextActions ?? [],
    rawReport: patch.rawReport ?? '',
    ...patch,
  }
}

const emptyQueue: AutoQueueView = {
  next: null,
  candidates: [],
  executable: [],
  waitingUser: [],
  held: [],
  aiHold: [],
  reviewWaiting: [],
  blocked: [],
  manual: [],
  pinnedExcluded: [],
  counts: { executable: 0, waiting_user: 0, held: 0, ai_hold: 0, review_waiting: 0, blocked: 0, manual: 0, done: 0, inbox: 0 },
  goalProgress: [],
  generatedAt: '2026-07-03T00:00:00.000Z',
}

const goalsData: GoalsData = {
  goals: [],
  updatedAt: '2026-07-03T00:00:00.000Z',
}

test('isNoopRun: 機械定型summaryと変更なしcompletedをnoop扱いする', () => {
  assert.equal(isNoopRun(run({ summary: '[review-fix] considered=1 executed=0', changedFiles: [] })), true)
  assert.equal(isNoopRun(run({ summary: '設定画面を改善', changedFiles: [] })), true)
  assert.equal(isNoopRun(run({ summary: '設定画面を改善', changedFiles: [{ file: 'a.ts', change: '' }] })), false)
})

test('formatAchievementText: 機械プレフィックスと箇条書きを除去して文末を補う', () => {
  assert.equal(formatAchievementText('- [factory-runner auto] executor=codex アプリ案画面の絞り込みを改善'), 'アプリ案画面の絞り込みを改善。')
})

test('buildReportDigestFromData: noopは成果に出さず、変更ありcompletedを人間向け成果にする', () => {
  const digest = buildReportDigestFromData([
    run({ runId: 'noop', summary: '[review-fix] considered=1 executed=0', changedFiles: [] }),
    run({ runId: 'done', summary: '- [factory-runner auto] executor=codex アプリ案画面の一覧を見やすく改善', targetApp: 'app-proposals' }),
  ], goalsData, emptyQueue)

  assert.equal(digest.counts.total, 2)
  assert.equal(digest.counts.noop, 1)
  assert.deepEqual(digest.achievements, [
    { app: 'app-proposals', text: 'アプリ案画面の一覧を見やすく改善。' },
  ])
})
