import type { TileIndex } from '@/types/mahjong'
import type { Agent, Observation } from './types'
import { calculateShanten } from '@/domain/mahjong/shanten'
import { cpuSelectDiscard } from '@/engine/cpuPlayer'
import { doraFromIndicator, featureVector, handFeatures, dot, FEATURE_DIM } from './features'
import { pick, type Rng } from './rng'

// 各候補（打牌）に対して「打牌後の13枚」を作るヘルパー。
function handAfterDiscard(fullHand: TileIndex[], discard: TileIndex): TileIndex[] {
  const i = fullHand.indexOf(discard)
  return fullHand.filter((_, j) => j !== i)
}
function uniqueTiles(tiles: TileIndex[]): TileIndex[] {
  return Array.from(new Set(tiles))
}

// ── ランダム打牌（下限ベースライン）──────────────────────────
export class RandomAgent implements Agent {
  readonly name = 'random'
  constructor(private rng: Rng) {}
  selectDiscard(obs: Observation): TileIndex {
    return pick(this.rng, obs.fullHand)
  }
}

// ── 向聴数最小（既存エンジンの思考をそのまま流用）───────────
export class ShantenAgent implements Agent {
  readonly name = 'shanten'
  selectDiscard(obs: Observation): TileIndex {
    return cpuSelectDiscard(obs.hand, obs.drawnTile)
  }
}

// ── 学習エージェント（特徴量×重みで打牌を選ぶ。重みを育てる）──
export class WeightedAgent implements Agent {
  readonly name: string
  weights: number[]
  constructor(weights: number[], name = 'weighted') {
    this.weights = weights.slice()
    this.name = name
  }
  static randomWeights(rng: Rng): number[] {
    return Array.from({ length: FEATURE_DIM }, () => rng() * 2 - 1)
  }
  selectDiscard(obs: Observation): TileIndex {
    const dora = obs.dora.map(doraFromIndicator)
    let best = obs.fullHand[0]
    let bestScore = -Infinity
    for (const t of uniqueTiles(obs.fullHand)) {
      const remain = handAfterDiscard(obs.fullHand, t)
      const score = dot(this.weights, featureVector(handFeatures(remain, dora)))
      if (score > bestScore) {
        bestScore = score
        best = t
      }
    }
    return best
  }
}

// 手作りの初期重み（向聴を重視。学習の出発点として妥当な事前知識）。
export const HAND_TUNED_WEIGHTS = [4, 1.5, 1, 1, 0.5]

// 完成手/テンパイに最短で向かうだけの参考エージェント（純粋シャンテン）。
export class GreedyShantenAgent implements Agent {
  readonly name = 'greedy'
  selectDiscard(obs: Observation): TileIndex {
    let best = obs.fullHand[0]
    let bestShanten = 99
    for (const t of uniqueTiles(obs.fullHand)) {
      const remain = handAfterDiscard(obs.fullHand, t)
      const s = calculateShanten(remain)
      if (s < bestShanten) {
        bestShanten = s
        best = t
      }
    }
    return best
  }
}
