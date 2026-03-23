// ========================================
// シャンテン数計算モジュール
// ========================================
// シャンテン数の定義:
//   -1 = 和了 (完成形)
//    0 = テンパイ (あと1枚で和了)
//    1 = 一向聴 (あと2枚)
//    ...
//
// 3種類の和了形を計算し最小値を返す:
//   1. 通常手   (4面子 + 1雀頭)
//   2. 七対子   (7種の対子)
//   3. 国士無双 (1・9・字牌13種 + 1枚対子)
// ========================================

/**
 * 通常手のシャンテン数を計算する (DFS)
 *
 * 手牌を面子・塔子・雀頭に分解し、
 * シャンテン = 8 - 2*面子数 - 塔子数 - 雀頭 の最小値を求める。
 * 制約: 面子 + 塔子 ≤ 4 (超過分はペナルティ)
 */
function standardShanten(counts: number[]): number {
  const c = [...counts]; // 破壊的変更のためコピー
  let best = 8;          // 最悪値で初期化

  /**
   * @param pos     現在注目しているインデックス
   * @param mentsu  確定した面子数
   * @param taatsu  確定した塔子・対子数 (雀頭を除く)
   * @param jantai  雀頭があれば 1、なければ 0
   */
  function dfs(
    pos: number,
    mentsu: number,
    taatsu: number,
    jantai: number
  ): void {
    // ── 現在の状態でシャンテン数を評価 ──
    // 面子+塔子の合計が 4 を超えた分はペナルティ
    const used = mentsu + taatsu;
    const penalty = used > 4 ? used - 4 : 0;
    const s = 8 - 2 * mentsu - taatsu - jantai + penalty;
    if (s < best) best = s;

    // 次に使う牌を探す (count=0 の牌をスキップ)
    while (pos < 34 && c[pos] === 0) pos++;
    if (pos >= 34) return;

    const i = pos;

    // ── 刻子 (同じ牌を3枚) ──
    if (c[i] >= 3) {
      c[i] -= 3;
      dfs(i, mentsu + 1, taatsu, jantai);
      c[i] += 3;
    }

    // ── 雀頭 (同じ牌を2枚、頭として使う) ──
    // 雀頭はまだ決まっていない場合のみ試みる
    if (c[i] >= 2 && jantai === 0) {
      c[i] -= 2;
      dfs(i, mentsu, taatsu, 1);
      c[i] += 2;
    }

    // ── 対子塔子 (同じ牌を2枚、塔子として使う) ──
    if (c[i] >= 2) {
      c[i] -= 2;
      dfs(i, mentsu, taatsu + 1, jantai);
      c[i] += 2;
    }

    // ── 数牌限定: 順子・連続塔子 ──
    if (i < 27) {
      const num = i % 9; // スーツ内の位置 (0-8)

      // 順子 (連続する3枚: i, i+1, i+2)
      if (num <= 6 && c[i + 1] >= 1 && c[i + 2] >= 1) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        dfs(i, mentsu + 1, taatsu, jantai);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }

      // 両面・辺張塔子 (i, i+1)
      if (num <= 7 && c[i + 1] >= 1) {
        c[i]--; c[i + 1]--;
        dfs(i, mentsu, taatsu + 1, jantai);
        c[i]++; c[i + 1]++;
      }

      // 嵌張塔子 (i, i+2)
      if (num <= 6 && c[i + 2] >= 1) {
        c[i]--; c[i + 2]--;
        dfs(i, mentsu, taatsu + 1, jantai);
        c[i]++; c[i + 2]++;
      }
    }

    // ── この牌を何も使わずスキップ ──
    dfs(i + 1, mentsu, taatsu, jantai);
  }

  dfs(0, 0, 0, 0);
  return best;
}

/**
 * 七対子のシャンテン数を計算する
 * シャンテン = 6 - 対子数
 * ただし種類数が7未満の場合は (7 - 種類数) のペナルティ
 */
function chiitoitsuShanten(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  // 同じ牌を2枚以上持っていても1対子としかカウントしない
  const uniquePairs = Math.min(pairs, kinds);
  return 6 - uniquePairs + Math.max(0, 7 - kinds);
}

/**
 * 国士無双のシャンテン数を計算する
 * 必要な牌: 1m 9m 1p 9p 1s 9s 1z-7z の13種 + うち1種の対子
 */
function kokushiShanten(counts: number[]): number {
  // 必要な13種のインデックス
  const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let kinds = 0;
  let hasPair = false;

  for (const i of terminals) {
    if (counts[i] >= 1) {
      kinds++;
      if (counts[i] >= 2) hasPair = true;
    }
  }

  return 13 - kinds - (hasPair ? 1 : 0);
}

/**
 * シャンテン数を計算する (通常手・七対子・国士の最小値)
 *
 * @param counts 長さ34の牌カウント配列
 * @returns シャンテン数 (-1〜8)
 */
export function calculateShanten(counts: number[]): number {
  return Math.min(
    standardShanten(counts),
    chiitoitsuShanten(counts),
    kokushiShanten(counts)
  );
}

/**
 * 有効牌のインデックス一覧を返す
 * 有効牌 = ツモるとシャンテン数が下がる牌
 *
 * @param counts 長さ34の牌カウント配列 (13枚の状態)
 * @returns 有効牌インデックスの配列
 */
export function getEffectiveTileIndices(counts: number[]): number[] {
  const baseShanten = calculateShanten(counts);
  const effective: number[] = [];

  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 4) continue; // 既に4枚持っているので引けない
    counts[i]++;
    const newShanten = calculateShanten(counts);
    if (newShanten < baseShanten) effective.push(i);
    counts[i]--;
  }

  return effective;
}

/**
 * 有効牌の受け入れ枚数合計を計算する
 * (山に残っている枚数 = 4 - 自分の手牌での枚数)
 *
 * @param effectiveIndices 有効牌インデックスの配列
 * @param counts           手牌カウント配列
 */
export function countEffectiveTiles(
  effectiveIndices: number[],
  counts: number[]
): number {
  return effectiveIndices.reduce((sum, i) => sum + (4 - counts[i]), 0);
}
