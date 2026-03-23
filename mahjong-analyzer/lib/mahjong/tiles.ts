// ========================================
// 牌の定数・変換ユーティリティ
// ========================================
// インデックス体系:
//   0- 8 : 1m-9m (万子)
//   9-17 : 1p-9p (筒子)
//  18-26 : 1s-9s (索子)
//  27-33 : 1z-7z (字牌: 東南西北白発中)
// ========================================

import { Tile, Suit } from "./types";

/** スーツごとのインデックスオフセット */
export const SUIT_OFFSET: Record<Suit, number> = {
  m: 0,
  p: 9,
  s: 18,
  z: 27,
};

/** 字牌の名前 (インデックス 0-6 に対応) */
export const HONOR_NAMES = ["東", "南", "西", "北", "白", "発", "中"];

/** Tile → インデックス (0-33) */
export function tileToIndex(tile: Tile): number {
  return SUIT_OFFSET[tile.suit] + tile.number - 1;
}

/** インデックス (0-33) → Tile */
export function indexToTile(index: number): Tile {
  if (index < 9)  return { suit: "m", number: index + 1 };
  if (index < 18) return { suit: "p", number: index - 8 };
  if (index < 27) return { suit: "s", number: index - 17 };
  return { suit: "z", number: index - 26 };
}

/** 牌を表示用テキストに変換 (例: {suit:"m",number:1} → "1m") */
export function tileToString(tile: Tile): string {
  if (tile.suit === "z") return HONOR_NAMES[tile.number - 1];
  return `${tile.number}${tile.suit}`;
}

/** 手牌配列 → カウント配列 (長さ 34) */
export function tilesToCounts(tiles: Tile[]): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[tileToIndex(t)]++;
  return counts;
}

/** 全牌のリスト (各1枚) */
export function getAllTileIndices(): number[] {
  return Array.from({ length: 34 }, (_, i) => i);
}
