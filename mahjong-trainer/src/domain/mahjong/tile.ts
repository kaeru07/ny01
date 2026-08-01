import type { Tile, TileIndex, TileSuit } from "@/types/mahjong";

// 牌インデックス 0-33 を Tile オブジェクトに変換
export function indexToTile(index: TileIndex): Tile {
  if (index < 9) return { suit: "man", number: index + 1, index };
  if (index < 18) return { suit: "pin", number: index - 8, index };
  if (index < 27) return { suit: "sou", number: index - 17, index };
  const honorNames = [27, 28, 29, 30, 31, 32, 33];
  return { suit: "honor", number: index - 26, index };
}

// 牌の名称を返す
export function tileName(index: TileIndex): string {
  const t = indexToTile(index);
  if (t.suit === "man") return `${t.number}万`;
  if (t.suit === "pin") return `${t.number}筒`;
  if (t.suit === "sou") return `${t.number}索`;
  const honors = ["東", "南", "西", "北", "白", "発", "中"];
  return honors[t.number - 1];
}

// 牌の略称 (表示用)
export function tileShort(index: TileIndex): string {
  const t = indexToTile(index);
  if (t.suit === "man") return `${t.number}m`;
  if (t.suit === "pin") return `${t.number}p`;
  if (t.suit === "sou") return `${t.number}s`;
  const honors = ["東", "南", "西", "北", "白", "発", "中"];
  return honors[t.number - 1];
}

// 136枚の山牌を生成 (各牌4枚)
export function createDeck(): TileIndex[] {
  const deck: TileIndex[] = [];
  for (let i = 0; i < 34; i++) {
    for (let j = 0; j < 4; j++) deck.push(i);
  }
  return deck;
}

// Fisher-Yatesシャッフル
export function shuffleDeck(deck: TileIndex[]): TileIndex[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// 手牌のソート (萬→筒→索→字牌, 各スート内は数字順)
export function sortTiles(tiles: TileIndex[]): TileIndex[] {
  return [...tiles].sort((a, b) => a - b);
}

// 牌が字牌かどうか
export function isHonor(index: TileIndex): boolean {
  return index >= 27;
}

// 牌が数牌かどうか
export function isSuited(index: TileIndex): boolean {
  return index < 27;
}

// 牌のスートを返す
export function getSuit(index: TileIndex): TileSuit {
  if (index < 9) return "man";
  if (index < 18) return "pin";
  if (index < 27) return "sou";
  return "honor";
}

// 牌の数字(1-9)を返す。字牌は1-7
export function getNumber(index: TileIndex): number {
  if (index < 9) return index + 1;
  if (index < 18) return index - 8;
  if (index < 27) return index - 17;
  return index - 26;
}

// 2枚の牌が同じスートか
export function sameSuit(a: TileIndex, b: TileIndex): boolean {
  return getSuit(a) === getSuit(b);
}

// 手牌テキスト表示 (デバッグ用)
export function handToString(tiles: TileIndex[]): string {
  return sortTiles(tiles).map(tileShort).join(" ");
}
