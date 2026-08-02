// 重みを育成する CLI。学習前後の和了率を比較する。
//   npm run ai:train -- [generations] [gamesPerEval]
import { train } from './train'
import { WeightedAgent } from './agents'

const generations = Number(process.argv[2] ?? 30)
const gamesPerEval = Number(process.argv[3] ?? 300)

console.log(`\n=== 麻雀AI育成 (世代=${generations}, 評価=${gamesPerEval}局/個体) ===`)
console.log('相手: 向聴エージェント×3 / 適応度: 席0の和了率\n')

const t0 = Date.now()
const res = train({
  generations,
  gamesPerEval,
  sigma: 0.4,
  seed: 42,
  evalSeed: 7,
})
const secs = ((Date.now() - t0) / 1000).toFixed(1)

console.log(`ベースライン(素の向聴)   和了率 ${(res.baselineFitness * 100).toFixed(1)}%`)
console.log(`育成後(重み最適化)       和了率 ${(res.bestFitness * 100).toFixed(1)}%`)
console.log(`改善                     ${((res.bestFitness - res.baselineFitness) * 100).toFixed(1)} ポイント`)
console.log(`\n最終重み: [${res.bestWeights.map((w) => w.toFixed(3)).join(', ')}]`)
console.log(`(特徴: -向聴, 待ち数, ドラ, 孤立ペナルティ, 対子数)`)

// 学習曲線（数世代ごと）
console.log('\n世代 適応度')
res.history.filter((h, i) => i % Math.max(1, Math.floor(generations / 10)) === 0 || i === res.history.length - 1)
  .forEach((h) => console.log(`${String(h.gen).padStart(3)}  ${(h.fitness * 100).toFixed(1)}%`))

console.log(`\n所要 ${secs}s`)
void WeightedAgent // 型参照（育成後の重みは WeightedAgent に渡して利用する）
