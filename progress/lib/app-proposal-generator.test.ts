import './test-alias.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeAiProposal, toCandidate } from './app-proposal-generator'

test('AI出力を承認可能なアプリ候補へ正規化し、生成根拠を保持する', () => {
  const proposal = normalizeAiProposal({
    title: '釣果メモ',
    purpose: '釣果を素早く記録して次の釣行に活かす。',
    features: ['記録', '検索'],
    screens: [{ name: '記録', rows: ['魚種', 'サイズ', '保存'] }],
    oceanType: 'invalid',
    riskFlags: ['billing', 'billing', 'unknown'],
    decisionPoints: [
      { key: 'platform', question: '最初の対象は？', options: ['iOS', 'Android'], required: true },
    ],
  })

  assert.ok(proposal)
  assert.equal(proposal.oceanType, 'unknown')
  assert.deepEqual(proposal.riskFlags, ['billing'])
  assert.equal(proposal.decisionPoints[0]?.required, true)

  const candidate = toCandidate(proposal, 0, '2026-07-20T00:00:00.000Z', {
    mode: 'ai',
    seedSources: ['research', 'knowledge'],
    proposalIndex: 1,
    promptVersion: 'test-v1',
  })

  assert.equal(candidate.status, 'proposed')
  assert.equal(candidate.factorySafe, false)
  assert.deepEqual(candidate.riskFlags, ['billing'])
  assert.deepEqual(candidate.derivation?.seedSources, ['research', 'knowledge'])
  assert.equal(candidate.derivation?.proposalIndex, 1)
  assert.match(candidate.nextAction, /今日の判断/)
})

test('必須項目を欠くAI出力は候補化しない', () => {
  assert.equal(normalizeAiProposal({ title: '名前だけ' }), null)
  assert.equal(normalizeAiProposal({ purpose: '目的だけ' }), null)
})
