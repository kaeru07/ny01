import type { TileIndex, PlayerIndex } from '@/types/mahjong'

// エージェントが打牌を決めるための観測情報。
export interface Observation {
  seat: PlayerIndex
  hand: TileIndex[]         // ツモ牌を除く手牌
  drawnTile: TileIndex      // 今ツモった牌
  fullHand: TileIndex[]     // hand + drawnTile（この中から1枚選んで打牌）
  discards: TileIndex[][]   // 各家の河（seat 順）
  dora: TileIndex[]         // ドラ表示牌
  turnCount: number
  wallCount: number
}

// 麻雀AIエージェントの共通インターフェース。
// selectDiscard は fullHand の中の1枚（打牌する牌）を返す。
export interface Agent {
  readonly name: string
  selectDiscard(obs: Observation): TileIndex
}

// 1ゲームの結果。
export interface GameResult {
  winner: PlayerIndex | null   // ツモ和了した席（流局は null）
  winningTile: TileIndex | null
  turns: number                // 総打牌数
  finalShanten: number[]       // 各家の最終向聴（評価用）
  ryukyoku: boolean
}

// エージェント別の対戦成績。
export interface AgentStats {
  name: string
  games: number
  wins: number
  winRate: number
  avgFinalShanten: number
  tenpaiRate: number           // 局終了時にテンパイしていた割合
}
