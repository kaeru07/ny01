// ========================================
// 手牌解析メインモジュール
// ========================================
// 13枚 → シャンテン数 + 有効牌を返す
// 14枚 → 打牌候補3件 (シャンテン数・有効牌・理由付き) を返す
// ========================================

import { Tile, AnalysisResult, DiscardCandidate } from "./types";
import { tileToIndex, indexToTile, tilesToCounts, tileToString } from "./tiles";
import {
  calculateShanten,
  getEffectiveTileIndices,
  countEffectiveTiles,
} from "./shanten";

// ── ラベル生成 ──────────────────────────────────────────────────

/**
 * 打牌候補にラベルを付与する
 *
 * @param discardIdx      切る牌のインデックス
 * @param resultShanten   切った後のシャンテン数
 * @param effectiveCount  切った後の有効牌受け入れ枚数
 * @param maxEffectiveCount 全候補中の最大受け入れ枚数
 * @param countsAfterDiscard 切った後の手牌カウント配列
 */
function buildLabels(
  discardIdx: number,
  resultShanten: number,
  effectiveCount: number,
  maxEffectiveCount: number,
  countsAfterDiscard: number[]
): string[] {
  const labels: string[] = [];

  // 即テンパイ
  if (resultShanten === 0) labels.push("即テンパイ");

  // 最大受け入れ (全候補中で最も広い)
  if (
    resultShanten > 0 &&
    effectiveCount === maxEffectiveCount &&
    maxEffectiveCount > 0
  ) {
    labels.push("受け入れ広い");
  }

  // 孤立牌 (字牌 or 数牌で前後に繋がりがない)
  if (isIsolated(discardIdx, countsAfterDiscard)) {
    labels.push("孤立牌");
  }

  // 字牌 (安全牌候補になりやすい)
  if (discardIdx >= 27) labels.push("安全牌候補");

  return labels;
}

/**
 * 牌が手牌内で孤立しているかを判定する
 * 孤立 = 同種の牌がなく、隣接する数牌もない
 */
function isIsolated(idx: number, counts: number[]): boolean {
  // 字牌: 対子以上でなければ孤立
  if (idx >= 27) return counts[idx] < 2;

  // 数牌: 複数枚あれば孤立ではない
  if (counts[idx] >= 2) return false;

  const num = idx % 9;
  if (num > 0 && counts[idx - 1] > 0) return false; // 左隣
  if (num < 8 && counts[idx + 1] > 0) return false; // 右隣
  if (num > 1 && counts[idx - 2] > 0) return false; // 嵌張 (左)
  if (num < 7 && counts[idx + 2] > 0) return false; // 嵌張 (右)

  return true;
}

// ── 理由テキスト生成 ────────────────────────────────────────────

/**
 * 打牌の理由を自然なテキストで生成する
 */
function buildReason(
  tile: Tile,
  resultShanten: number,
  effectiveTiles: Tile[],
  effectiveCount: number,
  labels: string[]
): string {
  const name = tileToString(tile);

  if (resultShanten === -1) {
    return `${name}を切ると和了形になります。`;
  }

  if (resultShanten === 0) {
    const waitNames = effectiveTiles.map(tileToString).join("・");
    return `${name}を切るとテンパイになります。待ち牌: ${waitNames} (${effectiveCount}枚)`;
  }

  const parts: string[] = [];

  if (labels.includes("孤立牌") && tile.suit === "z") {
    parts.push(`${name}は字牌の孤立牌。他の牌に影響せず安全に切れる`);
  } else if (labels.includes("孤立牌")) {
    parts.push(`${name}は周囲に繋がりのない孤立牌。切っても手の形は崩れない`);
  } else if (labels.includes("受け入れ広い")) {
    parts.push(`${name}を切ると有効牌が${effectiveCount}枚と最も受け入れが広い`);
  } else {
    parts.push(`${name}を切ることで手牌の接続を整えられる`);
  }

  // 上位5枚の有効牌を表示
  const topTiles = effectiveTiles.slice(0, 5).map(tileToString).join("・");
  if (topTiles) {
    parts.push(`有効牌 (${effectiveCount}枚): ${topTiles}${effectiveTiles.length > 5 ? "…" : ""}`);
  }

  return parts.join("。") + "。";
}

// ── メイン解析関数 ──────────────────────────────────────────────

/**
 * 手牌を解析する
 *
 * - 13枚: 現在のシャンテン数と有効牌を返す
 * - 14枚: 打牌候補3件 (各候補のシャンテン数・有効牌・ラベル・理由) を返す
 *
 * @param tiles 13枚または14枚の手牌
 */
export function analyzeHand(tiles: Tile[]): AnalysisResult {
  const tileCount = tiles.length as 13 | 14;
  const counts = tilesToCounts(tiles);

  // ── 13枚の場合 ──
  if (tileCount === 13) {
    const shanten = calculateShanten(counts);
    const effIdx = getEffectiveTileIndices(counts);
    const effectiveTiles = effIdx.map(indexToTile);
    const effectiveTileCount = countEffectiveTiles(effIdx, counts);

    return {
      hand: tiles,
      tileCount,
      shanten,
      effectiveTiles,
      effectiveTileCount,
      discardCandidates: [],
    };
  }

  // ── 14枚の場合: 各牌を1枚切る試算 ──
  const candidates: DiscardCandidate[] = [];
  const triedIdx = new Set<number>(); // 同じ牌の重複解析を防ぐ

  for (const tile of tiles) {
    const idx = tileToIndex(tile);
    if (triedIdx.has(idx)) continue;
    triedIdx.add(idx);

    // 1枚切る
    counts[idx]--;

    const resultShanten = calculateShanten(counts);
    const effIdx = getEffectiveTileIndices(counts);
    const effectiveTiles = effIdx.map(indexToTile);
    const effectiveCount = countEffectiveTiles(effIdx, counts);

    candidates.push({
      tile,
      resultShanten,
      effectiveTiles,
      effectiveTileCount: effectiveCount,
      labels: [],   // 後でセット
      reason: "",   // 後でセット
    });

    counts[idx]++;
  }

  // シャンテン数昇順 → 受け入れ枚数降順でソート
  candidates.sort((a, b) => {
    if (a.resultShanten !== b.resultShanten)
      return a.resultShanten - b.resultShanten;
    return b.effectiveTileCount - a.effectiveTileCount;
  });

  // 上位3候補にラベルと理由を付与
  const top3 = candidates.slice(0, 3);
  const maxCount = top3.reduce((m, c) => Math.max(m, c.effectiveTileCount), 0);

  for (const cand of top3) {
    const idx = tileToIndex(cand.tile);
    counts[idx]--;
    const afterCounts = [...counts];
    counts[idx]++;

    cand.labels = buildLabels(
      idx,
      cand.resultShanten,
      cand.effectiveTileCount,
      maxCount,
      afterCounts
    );
    cand.reason = buildReason(
      cand.tile,
      cand.resultShanten,
      cand.effectiveTiles,
      cand.effectiveTileCount,
      cand.labels
    );
  }

  // 14枚時の「現在シャンテン数」は最良打牌後の値
  const shanten = top3[0]?.resultShanten ?? 8;
  const effectiveTiles = top3[0]?.effectiveTiles ?? [];
  const effectiveTileCount = top3[0]?.effectiveTileCount ?? 0;

  return {
    hand: tiles,
    tileCount,
    shanten,
    effectiveTiles,
    effectiveTileCount,
    discardCandidates: top3,
  };
}
