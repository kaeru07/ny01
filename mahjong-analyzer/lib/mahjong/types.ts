// ========================================
// 麻雀アナライザー 型定義
// ========================================

/** 牌のスーツ: m=万子 p=筒子 s=索子 z=字牌 */
export type Suit = "m" | "p" | "s" | "z";

/** 1枚の牌 */
export interface Tile {
  suit: Suit;
  /** 数牌: 1-9 / 字牌: 1=東 2=南 3=西 4=北 5=白 6=発 7=中 */
  number: number;
}

/** パース結果 (成功 or 失敗) */
export type ParseResult =
  | { success: true; tiles: Tile[] }
  | { success: false; error: string };

/** 打牌候補 1件 */
export interface DiscardCandidate {
  tile: Tile;
  /** この牌を切った後のシャンテン数 */
  resultShanten: number;
  /** 切った後の有効牌リスト */
  effectiveTiles: Tile[];
  /** 有効牌の受け入れ枚数 (山に残っている想定枚数) */
  effectiveTileCount: number;
  /** 簡易ラベル (例: "受け入れ広い", "孤立牌" など) */
  labels: string[];
  /** 解説テキスト */
  reason: string;
}

/** 手牌解析結果 */
export interface AnalysisResult {
  /** 入力された手牌 */
  hand: Tile[];
  /** 手牌枚数 (13 or 14) */
  tileCount: 13 | 14;
  /** シャンテン数 (-1=和了, 0=テンパイ, 1=一向聴 ...) */
  shanten: number;
  /** 有効牌 (13枚時: ツモ有効牌 / 14枚時: 最良打牌後の有効牌) */
  effectiveTiles: Tile[];
  /** 受け入れ枚数合計 */
  effectiveTileCount: number;
  /** 打牌候補 (14枚時のみ, 最大3件) */
  discardCandidates: DiscardCandidate[];
}
