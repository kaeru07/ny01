// ========================================
// 手牌解析メインモジュール
// ========================================
// 13枚 → シャンテン数 + 有効牌を返す
// 14枚 → 異なる牌ごとの全打牌候補を返す
// ========================================

import { Tile, AnalysisResult, DiscardCandidate } from "./types";
import { tileToIndex, indexToTile, tilesToCounts, tileToString } from "./tiles";
import {
  calculateShanten,
  getEffectiveTileIndices,
  countEffectiveTiles,
} from "./shanten";
import { possibleYaku } from "./yaku";

/** 手牌から見えている同種牌を除いた、山に残る最大枚数を返す。 */
export function countRemainingTile(tile: Tile, visibleTiles: Tile[]): number {
  const targetIndex = tileToIndex(tile);
  const visibleCount = visibleTiles.reduce(
    (count, visibleTile) =>
      count + (tileToIndex(visibleTile) === targetIndex ? 1 : 0),
    0
  );

  return Math.max(0, 4 - visibleCount);
}

// ── ラベル生成 ──────────────────────────────────────────────────

/**
 * 打牌候補にラベルを付与する
 *
 * @param discardIdx      切る牌のインデックス
 * @param resultShanten   切った後のシャンテン数
 * @param effectiveCount  切った後の有効牌受け入れ枚数
 * @param maxEffectiveCount 全候補中の最大受け入れ枚数
 * @param bestShanten     全候補中の最小シャンテン数
 * @param countsAfterDiscard 切った後の手牌カウント配列
 */
function buildLabels(
  discardIdx: number,
  resultShanten: number,
  effectiveCount: number,
  maxEffectiveCount: number,
  bestShanten: number,
  countsAfterDiscard: number[]
): string[] {
  const labels: string[] = [];

  // 即テンパイ
  if (resultShanten === 0) labels.push("即テンパイ");

  // 最大受け入れ (全候補中で最も広い)
  if (
    resultShanten === bestShanten &&
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

  // 相手の河や場況を入力していないため安全性は判定せず、牌種だけを示す。
  if (discardIdx >= 27) labels.push("字牌");

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
    parts.push(`${name}は字牌の孤立牌。切っても手牌のつながりを崩しにくい`);
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
 * - 14枚: 異なる牌ごとの全打牌候補を返す
 *
 * @param tiles 13枚または14枚の手牌
 */
export function analyzeHand(tiles: Tile[]): AnalysisResult {
  // Expo の画面や端末保存から渡される値は、TypeScript の型だけでは実行時の
  // 破損を防げない。内部計算へ入る前に配列と各牌の形を検証し、null 参照などの
  // 不明瞭な例外ではなく、画面側で扱える入力エラーとして返す。
  if (!Array.isArray(tiles)) {
    throw new TypeError("手牌データは配列で指定してください");
  }

  if (tiles.length !== 13 && tiles.length !== 14) {
    throw new RangeError(
      `解析には13枚か14枚の手牌が必要です (現在${tiles.length}枚)`
    );
  }

  const invalidTileIndex = tiles.findIndex((tile) => {
    if (typeof tile !== "object" || tile === null) return true;

    const maxNumber = tile.suit === "z" ? 7 : 9;
    return (
      !["m", "p", "s", "z"].includes(tile.suit) ||
      !Number.isInteger(tile.number) ||
      tile.number < 1 ||
      tile.number > maxNumber ||
      (tile.isRed !== undefined && typeof tile.isRed !== "boolean")
    );
  });
  if (invalidTileIndex !== -1) {
    const invalidTile = tiles[invalidTileIndex] as Tile | null;
    const tileLabel = invalidTile
      ? `${String(invalidTile.number)}${String(invalidTile.suit)}`
      : `${invalidTileIndex + 1}枚目`;
    throw new RangeError(
      `存在しない牌が含まれています (${tileLabel})`
    );
  }

  const invalidRedTile = tiles.find(
    (tile) => tile.isRed && (tile.suit === "z" || tile.number !== 5)
  );
  if (invalidRedTile) {
    throw new RangeError(
      `赤ドラに指定できるのは数牌の5だけです (${invalidRedTile.number}${invalidRedTile.suit})`
    );
  }

  const redFiveCounts = new Map<string, number>();
  for (const tile of tiles) {
    if (!tile.isRed) continue;

    const count = (redFiveCounts.get(tile.suit) ?? 0) + 1;
    if (count > 1) {
      throw new RangeError(`同じ種類の赤5は1枚までです (0${tile.suit})`);
    }
    redFiveCounts.set(tile.suit, count);
  }

  const tileCount = tiles.length as 13 | 14;
  const counts = tilesToCounts(tiles);

  const impossibleTileIndex = counts.findIndex((count) => count > 4);
  if (impossibleTileIndex !== -1) {
    throw new RangeError(
      `同じ牌は4枚までです (${tileToString(indexToTile(impossibleTileIndex))})`
    );
  }

  // ── 13枚の場合 ──
  if (tileCount === 13) {
    const shanten = calculateShanten(counts);
    // 同種牌をすでに4枚持っている場合、その牌は山に残っていない。
    // シャンテン計算上の有効牌でも、実際に引けない牌は一覧から除外する。
    const effIdx = getEffectiveTileIndices(counts).filter(
      (effectiveIdx) => counts[effectiveIdx] < 4
    );
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

  // 14枚ですでに和了形なら、不要な打牌を勧めず完了状態を返す。
  // 打牌後のシャンテン数を結果にするとテンパイへ後退して見えるため、
  // 現在の手牌を先に判定する。
  if (calculateShanten(counts) === -1) {
    return {
      hand: tiles,
      tileCount,
      shanten: -1,
      effectiveTiles: [],
      effectiveTileCount: 0,
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

    // 赤5と通常5は牌効率上は同じ種類として解析するが、両方ある場合に
    // 赤ドラを捨てる表示にはしない。通常5を候補の代表牌として優先する。
    const discardTile =
      tiles.find(
        (candidate) => tileToIndex(candidate) === idx && !candidate.isRed
      ) ?? tile;

    // 1枚切る
    counts[idx]--;

    const resultShanten = calculateShanten(counts);
    const effIdx = getEffectiveTileIndices(counts).filter(
      // 捨てた牌も河の見えている牌として数える。元の手牌に同種牌が
      // 4枚あった場合、その牌は山に残っていないため一覧にも出さない。
      (effectiveIdx) =>
        counts[effectiveIdx] + (effectiveIdx === idx ? 1 : 0) < 4
    );
    const effectiveTiles = effIdx.map(indexToTile);
    // 捨てた牌は手牌から外れるが、河に見えており山には戻らない。
    // 同種の牌が有効牌の場合は、その1枚を受け入れ枚数から除外する。
    const effectiveCount =
      countEffectiveTiles(effIdx, counts) - (effIdx.includes(idx) ? 1 : 0);

    candidates.push({
      tile: discardTile,
      resultShanten,
      effectiveTiles,
      effectiveTileCount: effectiveCount,
      emergingYaku: [],
      vanishingYaku: [],
      labels: [], // 後でセット
      reason: "", // 後でセット
    });

    counts[idx]++;
  }

  // シャンテン数昇順 → 受け入れ枚数降順でソート。
  // そこまで同じ候補は牌種順にし、同じ手牌を別の並びで入力しても
  // 推奨順位が揺れないようにする。
  candidates.sort((a, b) => {
    if (a.resultShanten !== b.resultShanten)
      return a.resultShanten - b.resultShanten;
    if (a.effectiveTileCount !== b.effectiveTileCount)
      return b.effectiveTileCount - a.effectiveTileCount;
    return tileToIndex(a.tile) - tileToIndex(b.tile);
  });

  // 各打牌後に狙える役を集計し、和集合(unionSet)と共通集合(commonSet)を求める。
  //   unionSet  = どれかの打牌なら狙える役の全体
  //   commonSet = どの打牌でも狙える役（打牌に依存しない役）
  // 出る役   = この打牌後に狙える役 − commonSet（＝この打牌だから残る/活きる役）
  // 消える役 = unionSet − この打牌後に狙える役（＝この牌を切ると狙えなくなる役）
  const yakuAfterDiscard = new Map<number, Set<string>>();
  const unionSet = new Set<string>();
  let commonSet: Set<string> | null = null;
  for (const cand of candidates) {
    const idx = tileToIndex(cand.tile);
    counts[idx]--;
    const afterSet = new Set(possibleYaku(counts));
    counts[idx]++;
    yakuAfterDiscard.set(idx, afterSet);
    afterSet.forEach((yaku) => unionSet.add(yaku));
    if (commonSet === null) {
      commonSet = new Set<string>(afterSet);
    } else {
      const prev: Set<string> = commonSet;
      const next = new Set<string>();
      afterSet.forEach((yaku) => {
        if (prev.has(yaku)) next.add(yaku);
      });
      commonSet = next;
    }
  }
  const common = commonSet ?? new Set<string>();

  for (const cand of candidates) {
    const afterSet = yakuAfterDiscard.get(tileToIndex(cand.tile)) ?? new Set<string>();
    cand.emergingYaku = Array.from(afterSet).filter((yaku) => !common.has(yaku));
    cand.vanishingYaku = Array.from(unionSet).filter((yaku) => !afterSet.has(yaku));
  }

  // 上位3候補にランキング用ラベルを付与
  const top3 = candidates.slice(0, 3);
  const bestShanten = top3[0]?.resultShanten ?? 8;
  // 受け入れ幅はシャンテン数を維持できる候補同士でのみ比較する。
  // シャンテン数が悪化する候補の枚数が多くても「受け入れ広い」とは案内しない。
  const maxCount = top3
    .filter((candidate) => candidate.resultShanten === bestShanten)
    .reduce((max, candidate) => Math.max(max, candidate.effectiveTileCount), 0);

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
      bestShanten,
      afterCounts
    );
  }

  // 画面に表示する全候補に理由を付与する。
  // 4位以下はランキング用ラベルを持たないが、解析根拠は省略しない。
  for (const cand of candidates) {
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
    discardCandidates: candidates,
  };
}
