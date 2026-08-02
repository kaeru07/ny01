import type { Agent, AgentStats } from './types'
import { playGame, tenpaiFlags } from './env'
import { makeRng, type Rng } from './rng'

// 4エージェントで N 局まわして席ごとの成績を集計する。
export function runMatch(agents: Agent[], games: number, seed = 1): AgentStats[] {
  const rng: Rng = makeRng(seed)
  const wins = [0, 0, 0, 0]
  const shantenSum = [0, 0, 0, 0]
  const tenpai = [0, 0, 0, 0]

  for (let g = 0; g < games; g++) {
    const res = playGame(agents, rng)
    if (res.winner !== null) wins[res.winner] += 1
    const tf = tenpaiFlags(res)
    for (let s = 0; s < 4; s++) {
      shantenSum[s] += res.finalShanten[s]
      if (tf[s]) tenpai[s] += 1
    }
  }

  return agents.map((a, s): AgentStats => ({
    name: a.name,
    games,
    wins: wins[s],
    winRate: wins[s] / games,
    avgFinalShanten: shantenSum[s] / games,
    tenpaiRate: tenpai[s] / games,
  }))
}

// 対象エージェント1体を席0に置き、席1〜3を相手エージェントで固定して評価する。
// fitness = 対象の和了率（学習の適応度）。
export function evaluate(target: Agent, opponents: () => Agent[], games: number, seed = 1): number {
  const rng: Rng = makeRng(seed)
  let wins = 0
  for (let g = 0; g < games; g++) {
    const agents = [target, ...opponents()]
    const res = playGame(agents, rng)
    if (res.winner === 0) wins += 1
  }
  return wins / games
}
