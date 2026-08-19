import './test-alias.cjs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAiReviewApprovalDraft, classifyRun } from './ai-review.ts'
import { POST as postAiReview } from '../app/api/operations/ai-review/route.ts'
import type { ExecutionRun } from '../types/execution-run'

function makeRun(overrides: Partial<ExecutionRun>): ExecutionRun {
  return {
    runId: '20260720-120000',
    startedAt: '2026-07-20T12:00:00.000Z',
    finishedAt: '2026-07-20T12:05:00.000Z',
    targetApp: 'progress',
    targetTodoTitle: '研究ビューの並び順を整理',
    runStatus: 'completed',
    reviewStatus: 'not_reviewed',
    summary: '一覧の並び順を更新日時順に変更した',
    rawReport: '',
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    nextActions: [],
    ...overrides,
  } as ExecutionRun
}

test('classifyRun: 方針キーワード検知時は判断を求めている文を理由に引用する', () => {
  const run = makeRun({
    nextActions: ['カード一覧の表示方針を判断する必要がある', '次のrunで実装する'],
  })
  const cls = classifyRun(run)
  assert.equal(cls.verdict, 'needs_human')
  assert.equal(cls.rule, 'decision_needed')
  assert.ok(cls.reason.includes('カード一覧の表示方針を判断する必要がある'))
})

test('buildAiReviewApprovalDraft: decision_needed は曖昧な確認文言ではなく方針の選択肢を出す', () => {
  const run = makeRun({
    summary: '複数案があるため方針を選択してほしい',
  })
  const cls = classifyRun(run)
  const draft = buildAiReviewApprovalDraft(run, cls)

  assert.ok(draft.title.startsWith('方針の決定:'))
  assert.ok(draft.title.includes('進め方を選んでください'))
  // 検収系の曖昧ワード（問題なし/フォローアップ）を含まない → 今日の判断で方針選択カードとして描画される
  for (const option of draft.options) {
    assert.ok(!/問題なし|フォローアップ/.test(option.label), `曖昧ラベル: ${option.label}`)
  }
  // 既存承認APIの意味を保つ key で、明確な方針ラベルを持つ
  const byKey = Object.fromEntries(draft.options.map((o) => [o.key, o.label]))
  assert.ok(byKey.mark_reviewed.includes('ルールとして採用'))
  assert.ok(byKey.needs_followup.includes('別の方針'))
  assert.ok(byKey.hold.includes('保留'))
  assert.equal(draft.recommended, 'mark_reviewed')
})

test('buildAiReviewApprovalDraft: 危険キーワード（risk_keyword）は従来の検収文言のまま', () => {
  const run = makeRun({
    targetTodoTitle: '認証まわりの生存確認を追加',
    summary: '認証チェックを追加した',
  })
  const cls = classifyRun(run)
  assert.equal(cls.rule, 'risk_keyword')
  const draft = buildAiReviewApprovalDraft(run, cls)
  assert.ok(draft.title.startsWith('完了作業の確認:'))
  assert.equal(draft.options.find((o) => o.key === 'mark_reviewed')?.label, '問題なし（このままでよい）')
})

test('POST /api/operations/ai-review: needs_followup への更新と review_followup 候補生成を1回で完了する', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'progress-ai-review-'))
  const previous = process.env.PROGRESS_DATA_PATH
  process.env.PROGRESS_DATA_PATH = dir

  const run = makeRun({
    runId: '20260720-130000-followup',
    errors: ['関連テストが失敗'],
  })

  try {
    await fs.writeFile(path.join(dir, 'execution-runs.json'), JSON.stringify({ runs: [run] }))
    await fs.writeFile(path.join(dir, 'recommended-epics.json'), '[]')

    const response = await postAiReview(new Request('http://localhost/api/operations/ai-review', {
      method: 'POST',
      body: JSON.stringify({ limit: 1 }),
    }))
    const result = await response.json()
    const runs = JSON.parse(await fs.readFile(path.join(dir, 'execution-runs.json'), 'utf8')) as { runs: ExecutionRun[] }
    const recommendations = JSON.parse(await fs.readFile(path.join(dir, 'recommended-epics.json'), 'utf8')) as Array<{
      sourceKind?: string
      sourceRunId?: string
      followupOfRunId?: string
    }>

    assert.equal(response.status, 200)
    assert.equal(result.processed, 1)
    assert.equal(result.results[0]?.recommendationCreated, true)
    assert.equal(runs.runs[0]?.reviewStatus, 'needs_followup')
    assert.ok(recommendations.some((recommendation) => (
      recommendation.sourceKind === 'review_followup'
      && recommendation.sourceRunId === run.runId
      && recommendation.followupOfRunId === run.runId
    )))
  } finally {
    if (previous === undefined) delete process.env.PROGRESS_DATA_PATH
    else process.env.PROGRESS_DATA_PATH = previous
    await fs.rm(dir, { recursive: true, force: true })
  }
})
