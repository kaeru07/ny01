import type { TileIndex } from '@/types/mahjong'
import { calculateShanten, getTenpaiWaits } from '@/domain/mahjong/shanten'
import { isHonor, getNumber, getSuit } from '@/domain/mahjong/tile'

// 学習エージェントが「打牌後の13枚手牌」を評価するための特徴量。
// すべて「大きいほど良い」向きに正規化してあるので、重みとの内積が高いほど良い手。

export interface HandFeatures {
  negShanten: number      // -向聴（テンパイに近いほど大）
  waits: number           // テンパイ時の待ち牌種類数
  doraCount: number       // 手に残したドラ枚数
  isolatedPenalty: number // 孤立した端牌・字牌のペナルティ（負）
  pairCount: number       // 対子の数（面子候補）
}

const FEATURE_KEYS: (keyof HandFeatures)[] = [
  'negShanten', 'waits', 'doraCount', 'isolatedPenalty', 'pairCount',
]
export const FEATURE_DIM = FEATURE_KEYS.length

// ドラ表示牌からドラ本体の index を求める（次の牌。9→1、字牌は範囲内で循環）。
export function doraFromIndicator(indicator: TileIndex): TileIndex {
  if (isHonor(indicator)) {
    // 27-30=風（東南西北で循環）, 31-33=三元（白発中で循環）
    if (indicator <= 30) return indicator === 30 ? 27 : indicator + 1
    return indicator === 33 ? 31 : indicator + 1
  }
  const suitBase = indicator - ((indicator) % 9) // 各スートの先頭 index
  const n = getNumber(indicator)
  return n === 9 ? suitBase : indicator + 1
}

function countBy(tiles: TileIndex[]): Map<TileIndex, number> {
  const m = new Map<TileIndex, number>()
  for (const t of tiles) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}

// 隣接する数牌が手にあるか（孤立判定用）。
function hasNeighbor(counts: Map<TileIndex, number>, t: TileIndex): boolean {
  if (isHonor(t)) return false
  const n = getNumber(t)
  const suit = getSuit(t)
  for (const d of [-2, -1, 1, 2]) {
    const nn = n + d
    if (nn < 1 || nn > 9) continue
    const idx = t + d
    if (getSuit(idx) === suit && (counts.get(idx) ?? 0) > 0) return true
  }
  return false
}

export function handFeatures(hand13: TileIndex[], doraTiles: TileIndex[]): HandFeatures {
  const shanten = calculateShanten(hand13)
  const waits = shanten === 0 ? getTenpaiWaits(hand13).length : 0
  const counts = countBy(hand13)
  const doraSet = new Set(doraTiles)

  let doraCount = 0
  let isolatedPenalty = 0
  let pairCount = 0
  for (const [tile, c] of counts) {
    if (doraSet.has(tile)) doraCount += c
    if (c >= 2) pairCount += 1
    // 孤立: 1枚だけ かつ 端牌/字牌 かつ 隣接なし
    if (c === 1 && !hasNeighbor(counts, tile)) {
      const term = isHonor(tile) || getNumber(tile) === 1 || getNumber(tile) === 9
      if (term) isolatedPenalty -= 1
      else isolatedPenalty -= 0.5
    }
  }

  return {
    negShanten: -shanten,
    waits,
    doraCount,
    isolatedPenalty,
    pairCount,
  }
}

export function featureVector(f: HandFeatures): number[] {
  return FEATURE_KEYS.map((k) => f[k])
}

export function dot(w: number[], x: number[]): number {
  let s = 0
  for (let i = 0; i < w.length; i++) s += w[i] * x[i]
  return s
}
