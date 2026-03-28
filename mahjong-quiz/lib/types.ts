export type TileSuit = 'm' | 'p' | 's' | 'z'
export type TileStr = string // "1m", "9p", "3s", "7z", etc.

export type MeldType = 'chi' | 'pon' | 'kan' | 'ankan'

export interface Meld {
  type: MeldType
  tiles: TileStr[]
}

/** One discard entry: tile + whether it was drawn-and-discarded (ツモ切り) */
export interface Discard {
  tile: TileStr
  tsumokiri: boolean // true = ツモ切り, false = 手出し
}

export type SourceType = 'tenhou' | 'mahjongsoul' | 'manual'
export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type QuizCategory = 'basic' | 'kifu'

/** Round/game metadata from actual game records */
export interface SourceMeta {
  round: string      // e.g., "東1局", "南3局"
  honba: number      // 本場 (counter for dealer repeats)
  kyotaku: number    // 供託 (riichi sticks on table)
  seatWind?: string  // 自家 e.g., "東", "南", "西", "北"
  roundWind?: string // 場風 e.g., "東", "南"
}

/** One player's visible board state (捨て牌・副露・リーチ) */
export interface PlayerVisibleInfo {
  seat: string        // '上家' | '対面' | '下家'
  discards: Discard[]
  melds: Meld[]
  riichiState: boolean
  riichiTurn?: number
}

/** Information visible to all players (河・鳴き・リーチ状態など) */
export interface VisibleInfo {
  discards: Discard[]        // 和了者の捨て牌（ツモ切り/手出し区別あり）
  melds: Meld[]              // 和了者の副露（チー・ポン・カン）
  riichiState: boolean       // 和了者のリーチ宣言済みか
  riichiTurn?: number        // 和了者のリーチ宣言した巡目
  turn: number               // 現在の巡目
  doraIndicators: TileStr[]  // ドラ表示牌
  players?: PlayerVisibleInfo[] // 他家（上家・対面・下家）の河情報（optional）
}

/** Hidden information revealed only after answering */
export interface QuizAnswer {
  waits: TileStr[]      // 正解の待ち牌
  hand: TileStr[]       // 実際の手牌（クローズ部分）
  explanation: string   // 解説
}

export interface QuizQuestion {
  id: string
  title: string
  category: QuizCategory
  sourceType: SourceType
  sourceUrl?: string
  sourceMeta?: SourceMeta
  rankTier?: string
  difficulty: Difficulty
  tags: string[]
  visibleInfo: VisibleInfo
  answer: QuizAnswer
  maxAttempts?: number // override difficulty default (beginner=3, intermediate=4, advanced=5)
}

export interface QuizAttempt {
  questionId: string
  selectedTiles: TileStr[] // last submitted tile set
  isCorrect: boolean
  answeredAt: string // ISO date string
  attemptsUsed: number
  maxAttempts: number
  wrongTiles: TileStr[] // unique tiles that appeared in wrong submissions
}
