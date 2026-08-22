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
  // ネイティブ画面や端末保存との境界では TypeScript の型が保証されないため、
  // normalize を呼ぶ前に実行時の値も検証してクラッシュを防ぐ。
  if (typeof input !== "string") {
    return { success: false, error: "手牌は文字列で入力してください" };
  }

  // 日本語キーボードで入力されやすい全角の数字・英字を半角にそろえる。
  // NFKC は赤ドラの 0 やスーツ文字の意味を変えず、空白除去より先に行う。
  const str = input
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "");

  if (!str) {
    return { success: false, error: "手牌を入力してください" };
  }

  const tiles: Tile[] = [];
  let numBuf: number[] = []; // スーツ文字の前に蓄積する数字バッファ
  const redFiveSuits = new Set<Suit>();

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if ("0123456789".includes(ch)) {
      numBuf.push(parseInt(ch, 10));
      if (tiles.length + numBuf.length > 14) {
        return {
          success: false,
          error: "枚数が多すぎます (15枚以上)。13枚か14枚を入力してください",
        };
      }
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
        if (suit === "z" && num === 0) {
          return {
            success: false,
            error: '赤ドラの "0" は数牌 (m/p/s) のみに使用できます',
          };
        }

        // 0 は赤ドラ (5 として扱う)
        const n = num === 0 ? 5 : num;

        if (num === 0) {
          if (redFiveSuits.has(suit)) {
            return {
              success: false,
              error: `同じ種類の赤5は1枚までです (0${suit})`,
            };
          }
          redFiveSuits.add(suit);
        }

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

        tiles.push({ suit, number: n, isRed: num === 0 });
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
