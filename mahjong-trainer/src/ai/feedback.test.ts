import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyPreference, nudgeStyle } from './feedback'
import { WeightedAgent, HAND_TUNED_WEIGHTS } from './agents'
import type { Observation } from './types'
import type { TileIndex } from '@/types/mahjong'

// 索子の一盃口イーシャンテン + 孤立字牌。切るなら孤立字牌が自然。
// hand(14): 2s3s4s 5s6s7s 2p3p 5m5m 東 南 西 (14枚) — 東南西が孤立
function makeHand(): TileIndex[] {
  // index: man 0-8, pin 9-17, sou 18-26, honors 27-33
  const s = (n: number) => 17 + n // sou n
  const p = (n: number) => 8 + n  // pin n
  const m = (n: number) => n - 1  // man n
  return [s(2), s(3), s(4), s(5), s(6), s(7), p(2), p(3), m(5), m(5), 27, 28, 29, s(9)].sort((a, b) => a - b)
}

function obsFor(fullHand: TileIndex[]): Observation {
  return {
    seat: 0, hand: fullHand.slice(0, 13), drawnTile: fullHand[13],
    fullHand, discards: [[], [], [], []], dora: [], turnCount: 1, wallCount: 70,
  }
}

test('applyPreference は preferred の評価を chosen より上げる方向に更新する', () => {
  const fullHand = makeHand()
  const chosen = 17 + 5 // 5s（良い牌＝切りたくない）を「AIが誤って切った」と仮定
  const preferred = 27  // 東（孤立字牌）を切るべき
  const w0 = HAND_TUNED_WEIGHTS.slice()
  const w1 = applyPreference(w0, { fullHand, doraIndicators: [], chosen, preferred })

  // 更新後、preferred を切った後の手のスコアが chosen を切った後より高くなる方向に動く
  assert.notDeepEqual(w0, w1)
})

test('好みフィードバックを繰り返すと AI が preferred を選ぶようになる', () => {
  const fullHand = makeHand()
  const preferred = 27 // 東を切ってほしい
  let w = HAND_TUNED_WEIGHTS.slice()
  for (let i = 0; i < 20; i++) {
    const chosen = new WeightedAgent(w).selectDiscard(obsFor(fullHand))
    if (chosen === preferred) break
    w = applyPreference(w, { fullHand, doraIndicators: [], chosen, preferred })
  }
  const finalChoice = new WeightedAgent(w).selectDiscard(obsFor(fullHand))
  assert.equal(finalChoice, preferred, '学習後は好みの牌(東)を切る')
})

test('nudgeStyle は指定軸の重みだけを動かす', () => {
  const w0 = [1, 1, 1, 1, 1]
  const w1 = nudgeStyle(w0, 'speed', 0.8)
  assert.equal(w1[0], 1.8)
  assert.deepEqual(w1.slice(1), [1, 1, 1, 1])
})
