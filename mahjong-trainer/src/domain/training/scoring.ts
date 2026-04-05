import { TileIndex } from "@/types/mahjong";
import { ReadAttempt, ReviewResult, ReviewGrade, PREDICTABLE_ROLES, HandStyleId } from "@/types/training";
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

// 手牌スタイルタグの採点 (実際の手牌特徴と照合)
function scoreHandStyle(tags: HandStyleId[], actualHand: TileIndex[]): number {
  if (tags.length === 0) return 50; // 未入力は中間点

  const suits = actualHand.map(getSuit);
  const numbers = actualHand.map(getNumber);
  const nonHonorSuits = suits.filter(s => s !== "honor");
  const dominantSuitCount = Math.max(
    nonHonorSuits.filter(s => s === "man").length,
    nonHonorSuits.filter(s => s === "pin").length,
    nonHonorSuits.filter(s => s === "sou").length,
  );
  const honorCount = suits.filter(s => s === "honor").length;

  // 手牌から実際の特徴を推定
  const actualFeatures = {
    tanyao: numbers.every(n => n >= 2 && n <= 8) && honorCount === 0,
    somete: dominantSuitCount >= 8,
    honitsu: dominantSuitCount >= 7 && honorCount >= 2,
    toitsu: (() => {
      const cnt: Record<number, number> = {};
      actualHand.forEach(t => cnt[t] = (cnt[t] ?? 0) + 1);
      return Object.values(cnt).filter(c => c >= 2).length >= 4;
    })(),
    yakuhai: honorCount >= 3,
    // menzen/nakite/chiitoi are hard to determine from tiles alone
  };

  let score = 50;
  let checks = 0;

  if (tags.includes('tanyao')) {
    score += actualFeatures.tanyao ? 20 : -15;
    checks++;
  }
  if (tags.includes('somete') || tags.includes('honitsu')) {
    score += actualFeatures.somete ? 20 : -10;
    checks++;
  }
  if (tags.includes('toitsu') || tags.includes('chiitoi')) {
    score += actualFeatures.toitsu ? 20 : -10;
    checks++;
  }
  if (tags.includes('yakuhai')) {
    score += actualFeatures.yakuhai ? 15 : -10;
    checks++;
  }

  return Math.max(0, Math.min(100, score));
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

// グレード判定
function deriveGrade(total: number, waitScore: number): ReviewGrade {
  // 待ちが一部でも当たっていれば close 以上
  if (total >= 65 || (waitScore >= 50 && total >= 45)) return 'hit';
  if (total >= 35 || waitScore >= 25) return 'close';
  return 'miss';
}

// 実際の手牌から役の傾向ヒントを生成
function deriveYakuHints(actualHand: TileIndex[]): string[] {
  const hints: string[] = [];
  const suits = actualHand.map(getSuit);
  const numbers = actualHand.map(getNumber);
  const honorCount = suits.filter(s => s === "honor").length;
  const nonHonorSuits = suits.filter(s => s !== "honor");
  const manCount = nonHonorSuits.filter(s => s === "man").length;
  const pinCount = nonHonorSuits.filter(s => s === "pin").length;
  const souCount = nonHonorSuits.filter(s => s === "sou").length;
  const dominantCount = Math.max(manCount, pinCount, souCount);

  // タンヤオ形
  const isTanyao = actualHand.every(t => getSuit(t) !== "honor" && getNumber(t) >= 2 && getNumber(t) <= 8);
  if (isTanyao) hints.push("タンヤオ形");

  // 染め手 (清一色/混一色)
  if (dominantCount >= 10 && honorCount === 0) hints.push("清一色方向");
  else if (dominantCount >= 8) hints.push("混一色/染め手方向");

  // 七対子形 (対子が多い)
  const tileCounts: Record<number, number> = {};
  actualHand.forEach(t => { tileCounts[t] = (tileCounts[t] ?? 0) + 1; });
  const pairCount = Object.values(tileCounts).filter(c => c >= 2).length;
  if (pairCount >= 5) hints.push("七対子形");
  else if (pairCount >= 4) hints.push("対子系");

  // 対々和形 (刻子が多い)
  const tripletCount = Object.values(tileCounts).filter(c => c >= 3).length;
  if (tripletCount >= 3) hints.push("対々和方向");

  // 役牌形 (字牌が3枚以上)
  if (honorCount >= 3) hints.push("役牌系");

  // 一気通貫/三色の可能性 (1-9が連続)
  const hasSequence = [1,2,3,4,5,6,7].some(n =>
    actualHand.some(t => getNumber(t) === n) &&
    actualHand.some(t => getNumber(t) === n+1) &&
    actualHand.some(t => getNumber(t) === n+2)
  );
  if (hasSequence && !isTanyao && hints.length === 0) hints.push("順子系");

  return hints.length > 0 ? hints : ["読みにくい手形"];
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
  const styleScore = scoreHandStyle((attempt.handStyleTags ?? []) as HandStyleId[], actualHand);
  const rangeScore = scoreRange(attempt.tileRangePrediction, actualHand);
  const roleScore = scoreRoles(attempt.rolePrediction, actualHand);
  const total = Math.round(waitScore * 0.45 + styleScore * 0.25 + rangeScore * 0.1 + roleScore * 0.2);

  const predictedSet = new Set(attempt.waitPrediction);
  const actualSet = new Set(actualWaits);

  const comparison = {
    correctWaits: actualWaits.filter((t) => predictedSet.has(t)),
    missedWaits: actualWaits.filter((t) => !predictedSet.has(t)),
    wrongWaits: attempt.waitPrediction.filter((t) => !actualSet.has(t)),
  };

  const grade = deriveGrade(total, waitScore);
  const yakuHints = deriveYakuHints(actualHand);

  return {
    attemptId: attempt.id,
    targetPlayer: attempt.targetPlayer,
    actualHand,
    actualWaits,
    grade,
    yakuHints,
    scores: { waitScore, styleScore, rangeScore, roleScore, total },
    feedback: generateFeedback(waitScore, rangeScore, comparison),
    comparison,
  };
}
