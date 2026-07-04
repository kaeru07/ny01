import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDecisionRequests } from './decision-request.ts'

test('parseDecisionRequests: 推奨ありの判断要求をパースする', () => {
  const requests = parseDecisionRequests('[判断要求] ホーム画面のデザイン方向は？ | シンプル白基調 | ダーク情報密度高 | 推奨:シンプル白基調')

  assert.deepEqual(requests, [
    {
      question: 'ホーム画面のデザイン方向は？',
      options: ['シンプル白基調', 'ダーク情報密度高'],
      recommended: 'シンプル白基調',
    },
  ])
})

test('parseDecisionRequests: 推奨なしの判断要求をパースする', () => {
  const requests = parseDecisionRequests('[判断要求] ナビ構造は？ | タブ型 | ドロワー型 | ホーム集約型')

  assert.deepEqual(requests, [
    {
      question: 'ナビ構造は？',
      options: ['タブ型', 'ドロワー型', 'ホーム集約型'],
      recommended: undefined,
    },
  ])
})

test('parseDecisionRequests: 不正行を無視する', () => {
  const requests = parseDecisionRequests([
    '[判断要求]  ',
    '[判断要求] 選択肢不足 | A',
    '[判断要求] 選択肢過多 | A | B | C | D | E | 推奨:A',
    'prefix [判断要求] 行頭ではない | A | B',
    '[判断要求] 正常 | A | B',
  ].join('\n'))

  assert.deepEqual(requests, [
    {
      question: '正常',
      options: ['A', 'B'],
      recommended: undefined,
    },
  ])
})

test('parseDecisionRequests: 最大3件まで返す', () => {
  const text = Array.from({ length: 5 }, (_, index) => (
    `[判断要求] Q${index + 1} | A${index + 1} | B${index + 1} | 推奨:A${index + 1}`
  )).join('\n')

  const requests = parseDecisionRequests(text)

  assert.equal(requests.length, 3)
  assert.deepEqual(requests.map((request) => request.question), ['Q1', 'Q2', 'Q3'])
})
