import type { Rng } from './rng'
import { makeRng } from './rng'
import { WeightedAgent, ShantenAgent, HAND_TUNED_WEIGHTS } from './agents'
import { evaluate } from './selfplay'
import { FEATURE_DIM } from './features'

export interface TrainConfig {
  generations: number     // 世代数
  gamesPerEval: number    // 1個体の評価に使う局数
  sigma: number           // 重みの摂動幅
  seed: number
  evalSeed: number        // 評価用の固定シード（世代間で公平に比較）
  startWeights?: number[]
}

export interface TrainResult {
  bestWeights: number[]
  bestFitness: number
  baselineFitness: number
  history: { gen: number; fitness: number }[]
}

// 相手は素の向聴エージェント3体（固定ベースライン）。
function opponents() {
  return [new ShantenAgent(), new ShantenAgent(), new ShantenAgent()]
}

function perturb(w: number[], sigma: number, rng: Rng): number[] {
  return w.map((v) => v + (rng() * 2 - 1) * sigma)
}

// (1+1) 進化戦略による重みの育成（ヒルクライム）。
// 各世代で現行重みを摂動→評価→良ければ採用。和了率が育つ。
export function train(cfg: TrainConfig): TrainResult {
  const rng = makeRng(cfg.seed)
  let current = (cfg.startWeights ?? HAND_TUNED_WEIGHTS).slice()
  if (current.length !== FEATURE_DIM) {
    current = HAND_TUNED_WEIGHTS.slice()
  }

  const evalOf = (w: number[]) =>
    evaluate(new WeightedAgent(w), opponents, cfg.gamesPerEval, cfg.evalSeed)

  // ベースライン: 学習前の素の向聴エージェント（席0）の和了率
  const baselineFitness = evaluate(new ShantenAgent(), opponents, cfg.gamesPerEval, cfg.evalSeed)

  let bestFitness = evalOf(current)
  const history: { gen: number; fitness: number }[] = [{ gen: 0, fitness: bestFitness }]

  for (let gen = 1; gen <= cfg.generations; gen++) {
    const candidate = perturb(current, cfg.sigma, rng)
    const fit = evalOf(candidate)
    if (fit >= bestFitness) {
      current = candidate
      bestFitness = fit
    }
    history.push({ gen, fitness: bestFitness })
  }

  return { bestWeights: current, bestFitness, baselineFitness, history }
}
