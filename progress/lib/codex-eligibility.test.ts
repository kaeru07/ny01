import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyCodexEligibility } from './codex-eligibility.ts'

// 回帰: runId 20260711-140030-019。「課金/本番/認証/破壊/外部公開の安全ゲートは維持」という
// 制約の再掲文が deny 誤検知され、Claude 上限時に Codex fallback が requires_claude で停止した。
test('classifyCodexEligibility: 安全ゲート維持の列挙文は deny 誤検知しない（Codex優先化GoalのEpic文面）', () => {
  const goalText =
    'Goal「自動実行の実装をCodex優先化してClaude消費を抑える(安全ゲート維持)」の達成に向けて、次の具体的な1ステップを進める。' +
    'factory-runnerの実装系タスクをCodex優先で実行し、Claudeは判断/レビュー/検証/安全判断に寄せる。' +
    '課金/本番/認証/破壊/外部公開の安全ゲートは維持。Claudeの使用量上限による停止を減らす。' +
    ' 定義したステップを実装・実行し、該当する検証（tsc / build / 動作確認など）まで完了する'
  const verdict = classifyCodexEligibility(goalText)
  assert.equal(verdict.eligible, true)
})

test('classifyCodexEligibility: 実際の課金作業は引き続き deny', () => {
  const verdict = classifyCodexEligibility('課金機能を実装して build を通す')
  assert.equal(verdict.eligible, false)
  assert.match(verdict.reason, /課金/)
})

test('classifyCodexEligibility: 安全ゲート維持に言及しつつ危険作業を含む文は deny のまま', () => {
  const verdict = classifyCodexEligibility('課金/本番の安全ゲートは維持しつつ、認証フローを変更して build する')
  assert.equal(verdict.eligible, false)
  assert.match(verdict.reason, /認証/)
})

test('classifyCodexEligibility: 安全ゲート維持の列挙のみで安全シグナルが無ければ既定で Claude', () => {
  const verdict = classifyCodexEligibility('課金/本番/認証/破壊/外部公開の安全ゲートは維持する')
  assert.equal(verdict.eligible, false)
  assert.match(verdict.reason, /安全シグナル未検出/)
})

test('classifyCodexEligibility: 安全シグナルのみは eligible', () => {
  const verdict = classifyCodexEligibility('typecheck と lint を通す')
  assert.equal(verdict.eligible, true)
})

test('英単語の危険シグナルは単語境界で判定する（secretary を secret と誤判定しない）', () => {
  // 実例: 「company配下のドキュメント(CLAUDE.md, pm/, secretary/)を点検する」が
  // 'secret' 扱いで自動実行ブロックされた（2026-08-22 / pq-mt3ya8v3-7utu2f）
  assert.equal(classifyCodexEligibility('company配下のドキュメント(CLAUDE.md, pm/, secretary/)を点検する').eligible, true)
  assert.equal(classifyCodexEligibility('reproduction の手順をドキュメント化する').eligible, true)

  // 本物の危険シグナルは引き続き弾く
  assert.equal(classifyCodexEligibility('secret を表示する').eligible, false)
  assert.equal(classifyCodexEligibility('production db を触る').eligible, false)
  assert.equal(classifyCodexEligibility('.env を編集する').eligible, false)
  assert.equal(classifyCodexEligibility('本番DBを削除する').eligible, false)
})
