import type { TileIndex } from '@/types/mahjong'
import type { Observation } from './types'
import { createDeck, shuffleDeck } from '@/domain/mahjong/tile'
import { WeightedAgent } from './agents'

// フィードバック学習用に、ランダムな14枚手牌とドラを配る（端末内で完結）。
export interface PracticeHand {
  fullHand: TileIndex[]     // 14枚（この中から1枚切る）
  doraIndicators: TileIndex[]
}

export function dealPracticeHand(): PracticeHand {
  const deck = shuffleDeck(createDeck())
  const fullHand = deck.slice(0, 14).sort((a, b) => a - b)
  const doraIndicators = [deck[14]]
  return { fullHand, doraIndicators }
}

// 現在の重みで AI の打牌提案を得る（14枚 → 切る1枚）。
export function suggestDiscard(weights: number[], hand: PracticeHand): TileIndex {
  const obs: Observation = {
    seat: 0,
    hand: hand.fullHand.slice(0, 13),
    drawnTile: hand.fullHand[13],
    fullHand: hand.fullHand,
    discards: [[], [], [], []],
    dora: hand.doraIndicators,
    turnCount: 1,
    wallCount: 70,
  }
  return new WeightedAgent(weights).selectDiscard(obs)
}
