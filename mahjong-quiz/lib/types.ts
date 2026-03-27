export type TileSuit = 'm' | 'p' | 's' | 'z'
export type TileStr = string // "1m", "9p", "3s", "7z", etc.

export type MeldType = 'chi' | 'pon' | 'kan' | 'ankan'

export interface Meld {
  type: MeldType
  tiles: TileStr[]
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

export interface QuizQuestion {
  id: string
  title: string
  category: QuizCategory
  sourceType: SourceType
  sourceUrl?: string
  sourceMeta?: SourceMeta
  rankTier?: string
  // Board state
  hand: TileStr[]           // 13 tiles (tenpai, closed portion)
  discards: TileStr[]       // River tiles in order
  melds: Meld[]             // Open melds (副露)
  turn: number              // Draw/turn count
  doraIndicators: TileStr[] // Dora indicator tile(s)
  riichiState: boolean      // Is riichi declared?
  // Quiz data
  waits: TileStr[]          // Correct wait tiles (answer)
  difficulty: Difficulty
  tags: string[]
  explanation: string
}

export interface QuizAttempt {
  questionId: string
  selectedTiles: TileStr[]
  isCorrect: boolean
  answeredAt: string // ISO date string
}
