import { TileIndex } from "@/types/mahjong";
import { ReadAttempt, ReviewResult, PREDICTABLE_ROLES } from "@/types/training";
import { getTenpaiWaits } from "@/domain/mahjong/shanten";
import { getSuit, getNumber } from "@/domain/mahjong/tile";

// ============================================================
// 読み採点ロジック
// ============================================================

// Jaccard係数 (集合の類似度): |A∩B| / |A∪B|
function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

// 手牌レンジ予想の採点
// predicted: ユーザーが予想した牌リスト
// actual: 実際の手牌
function scoreRange(predicted: TileIndex[], actual: TileIndex[]): number {
  if (predicted.length === 0) return 0;
  const predSet = new Set(predicted);
  const actualSet = new Set(actual);
  const j = jaccard(predSet, actualSet);
  return Math.round(j * 100);
}

// 待ち牌予想の採点
function scoreWaits(predicted: TileIndex[], actual: TileIndex[]): number {
  if (actual.length === 0) return predicted.length === 0 ? 100 : 0;
  if (predicted.length === 0) return 0;
  const predSet = new Set(predicted);
  const actualSet = new Set(actual);
  const j = jaccard(predSet, actualSet);
  return Math.round(j * 100);
}

// 役予想の採点 (TODO: 将来的に実際の手牌から役を自動推定して比較)
function scoreRoles(predicted: string[], actualHand: TileIndex[]): number {
  // 初期版: 簡易ヒューリスティック採点
  if (predicted.length === 0) return 50; // 予想なしは中間点

  let score = 50;

  // タンヤオ予想: 手牌に1/9/字牌がなければ+20
  if (predicted.includes("tanyao")) {
    const hasTanyao = actualHand.every((t) => {
      const n = getNumber(t);
      const s = getSuit(t);
      return s !== "honor" && n >= 2 && n <= 8;
    });
    score += hasTanyao ? 25 : -15;
  }

  // 混一色/清一色: スート集中度で判定
  if (predicted.includes("honitsu") || predicted.includes("chinitsu")) {
    const suits = new Set(actualHand.map(getSuit));
    const hasHonorOnly = [...suits].every((s) => s === "honor");
    const dominated =
      [...suits].filter((s) => s !== "honor").length <= 1;
    score += dominated ? 20 : -10;
  }

  return Math.max(0, Math.min(100, score));
}

// フィードバック文生成
function generateFeedback(
  waitScore: number,
  rangeScore: number,
  comparison: ReviewResult["comparison"]
): string[] {
  const msgs: string[] = [];

  if (waitScore >= 80) {
    msgs.push("待ち予想は非常に正確でした！");
  } else if (waitScore >= 50) {
    msgs.push("待ちの方向性は合っていましたが、一部見落としがありました。");
  } else {
    msgs.push("待ち予想に改善の余地があります。テンパイ形をより丁寧に読みましょう。");
  }

  if (comparison.correctWaits.length > 0) {
    // correct waits present - good
  }
  if (comparison.missedWaits.length > 0) {
    msgs.push(`見落とした待ち: ${comparison.missedWaits.length}枚`);
  }
  if (comparison.wrongWaits.length > 0) {
    msgs.push(`誤った待ち予想: ${comparison.wrongWaits.length}枚`);
  }

  if (rangeScore >= 70) {
    msgs.push("手牌レンジ読みは高精度でした。");
  } else if (rangeScore >= 40) {
    msgs.push("手牌レンジはある程度合っていました。");
  } else {
    msgs.push("手牌レンジ予想は難しい局面でした。");
  }

  return msgs;
}

// 局後の答え合わせを計算
export function computeReviewResult(
  attempt: ReadAttempt,
  actualHand: TileIndex[]
): ReviewResult {
  const actualWaits = getTenpaiWaits(actualHand);

  const waitScore = scoreWaits(attempt.waitPrediction, actualWaits);
  const rangeScore = scoreRange(attempt.tileRangePrediction, actualHand);
  const roleScore = scoreRoles(attempt.rolePrediction, actualHand);
  const total = Math.round(waitScore * 0.5 + rangeScore * 0.3 + roleScore * 0.2);

  const predictedSet = new Set(attempt.waitPrediction);
  const actualSet = new Set(actualWaits);

  const comparison = {
    correctWaits: actualWaits.filter((t) => predictedSet.has(t)),
    missedWaits: actualWaits.filter((t) => !predictedSet.has(t)),
    wrongWaits: attempt.waitPrediction.filter((t) => !actualSet.has(t)),
  };

  return {
    attemptId: attempt.id,
    targetPlayer: attempt.targetPlayer,
    actualHand,
    actualWaits,
    scores: { waitScore, rangeScore, roleScore, total },
    feedback: generateFeedback(waitScore, rangeScore, comparison),
    comparison,
  };
}
