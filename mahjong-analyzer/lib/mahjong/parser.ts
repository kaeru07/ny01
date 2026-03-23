// ========================================
// 手牌入力パーサー
// ========================================
// 入力形式: "123m456p789s11z" のように
//   数字の後にスーツ文字 (m/p/s/z) を付ける
// ========================================

import { Tile, Suit, ParseResult } from "./types";

/**
 * 手牌文字列をパースして Tile[] に変換する
 *
 * @example
 * parseHand("123m456p789s11z")  // 13枚
 * parseHand("1123m456p789s11z") // 14枚
 */
export function parseHand(input: string): ParseResult {
  const str = input.trim().replace(/\s+/g, "");

  if (!str) {
    return { success: false, error: "手牌を入力してください" };
  }

  const tiles: Tile[] = [];
  let numBuf: number[] = []; // スーツ文字の前に蓄積する数字バッファ

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if ("0123456789".includes(ch)) {
      numBuf.push(parseInt(ch, 10));
      continue;
    }

    if ("mpszMPSZ".includes(ch)) {
      const suit = ch.toLowerCase() as Suit;

      if (numBuf.length === 0) {
        return {
          success: false,
          error: `"${ch}" の前に数字がありません (${i + 1}文字目)`,
        };
      }

      for (const num of numBuf) {
        // 0 は赤ドラ (5 として扱う)
        const n = num === 0 ? 5 : num;

        if (suit === "z" && (n < 1 || n > 7)) {
          return {
            success: false,
            error: `字牌 (z) は 1〜7 の範囲です。"${num}z" は無効です`,
          };
        }
        if (suit !== "z" && (n < 1 || n > 9)) {
          return {
            success: false,
            error: `数牌は 1〜9 の範囲です。"${num}${suit}" は無効です`,
          };
        }

        tiles.push({ suit, number: n });
      }

      numBuf = [];
      continue;
    }

    return {
      success: false,
      error: `不正な文字 "${ch}" が含まれています (${i + 1}文字目)`,
    };
  }

  if (numBuf.length > 0) {
    return {
      success: false,
      error: `末尾の数字 "${numBuf.join("")}" の後にスーツ文字 (m/p/s/z) がありません`,
    };
  }

  // 枚数チェック
  if (tiles.length < 13) {
    return {
      success: false,
      error: `枚数が少なすぎます (${tiles.length}枚)。13枚か14枚を入力してください`,
    };
  }
  if (tiles.length > 14) {
    return {
      success: false,
      error: `枚数が多すぎます (${tiles.length}枚)。13枚か14枚を入力してください`,
    };
  }

  // 同じ牌が5枚以上になっていないかチェック
  const countMap: Record<string, number> = {};
  for (const t of tiles) {
    const key = `${t.number}${t.suit}`;
    countMap[key] = (countMap[key] ?? 0) + 1;
    if (countMap[key] > 4) {
      return {
        success: false,
        error: `同じ牌が5枚以上あります (${key})`,
      };
    }
  }

  return { success: true, tiles };
}
