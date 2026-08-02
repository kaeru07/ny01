// 自己対戦の成績を表示する CLI。
//   npm run ai:selfplay -- [games] [seed]
import { runMatch } from './selfplay'
import { RandomAgent, ShantenAgent, WeightedAgent, HAND_TUNED_WEIGHTS } from './agents'
import { makeRng } from './rng'

const games = Number(process.argv[2] ?? 500)
const seed = Number(process.argv[3] ?? 1)
const rng = makeRng(seed + 999)

// 席0=ランダム, 席1=向聴, 席2=向聴, 席3=手調整重み
const agents = [
  new RandomAgent(rng),
  new ShantenAgent(),
  new ShantenAgent(),
  new WeightedAgent(HAND_TUNED_WEIGHTS, 'weighted(tuned)'),
]

const stats = runMatch(agents, games, seed)
console.log(`\n=== 自己対戦 ${games} 局 (seed=${seed}) ===`)
console.log('席  エージェント          和了率   最終平均向聴  テンパイ率')
stats.forEach((s, i) => {
  console.log(
    `${i}   ${s.name.padEnd(18)} ${(s.winRate * 100).toFixed(1).padStart(5)}%  ` +
    `${s.avgFinalShanten.toFixed(2).padStart(9)}   ${(s.tenpaiRate * 100).toFixed(1).padStart(5)}%`
  )
})
const decided = stats.reduce((a, s) => a + s.wins, 0)
console.log(`\n決着(ツモ和了) ${decided} / ${games} 局, 流局 ${games - decided} 局`)
