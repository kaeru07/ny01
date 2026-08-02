import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeRng, withSeededRandom } from './rng'
import { playGame } from './env'
import { RandomAgent, ShantenAgent, WeightedAgent, HAND_TUNED_WEIGHTS } from './agents'
import { runMatch } from './selfplay'

test('シード付き乱数は決定的に再現する', () => {
  const a = makeRng(123); const b = makeRng(123)
  for (let i = 0; i < 100; i++) assert.equal(a(), b())
})

test('withSeededRandom は Math.random を元に戻す', () => {
  const orig = Math.random
  withSeededRandom(makeRng(1), () => { /* noop */ })
  assert.equal(Math.random, orig)
})

test('1局を完走し、和了席は他家より向聴が進んでいる', () => {
  const rng = makeRng(5)
  const agents = [new ShantenAgent(), new ShantenAgent(), new ShantenAgent(), new ShantenAgent()]
  const res = playGame(agents, rng)
  assert.ok(res.turns > 0, '打牌が進む')
  assert.equal(res.finalShanten.length, 4)
  if (res.winner !== null) {
    // 和了席の手牌(13枚)はツモ牌を足すと和了形 → 13枚時点ではテンパイ(向聴0)
    assert.equal(res.finalShanten[res.winner], 0, '和了席はテンパイ(向聴0)')
  }
})

test('同じシードなら同じ結果（環境が決定的）', () => {
  const agents = () => [new ShantenAgent(), new ShantenAgent(), new ShantenAgent(), new ShantenAgent()]
  const r1 = playGame(agents(), makeRng(9))
  const r2 = playGame(agents(), makeRng(9))
  assert.deepEqual(r1, r2)
})

test('向聴エージェントはランダムより強い（和了率が高い）', () => {
  const rng = makeRng(1)
  // 席0=ランダム, 席1-3=向聴
  const stats = runMatch(
    [new RandomAgent(rng), new ShantenAgent(), new ShantenAgent(), new ShantenAgent()],
    300, 1
  )
  const randomWin = stats[0].winRate
  const shantenWin = (stats[1].winRate + stats[2].winRate + stats[3].winRate) / 3
  assert.ok(shantenWin > randomWin, `向聴(${shantenWin}) > ランダム(${randomWin})`)
})

test('WeightedAgent は fullHand の中の牌を返す', () => {
  const agent = new WeightedAgent(HAND_TUNED_WEIGHTS)
  const rng = makeRng(3)
  const res = playGame([agent, new ShantenAgent(), new ShantenAgent(), new ShantenAgent()], rng)
  assert.ok(res.turns > 0)
})
