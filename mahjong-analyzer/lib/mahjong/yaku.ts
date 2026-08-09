import { calculateShanten } from "./shanten";

const YAKU = {
  riichi: "リーチ",
  tanyao: "タンヤオ",
  pinfu: "平和",
  yakuhai: "役牌(白發中)",
  chiitoitsu: "七対子",
  toitoi: "対々和",
  honitsu: "混一色",
  chinitsu: "清一色",
  sanshoku: "三色同順",
  ittsuu: "一気通貫",
  iipeikou: "一盃口",
} as const;

/**
 * 13枚の門前手から、現在の形を大きく崩さず狙える役を近似判定する。
 * 和了形の厳密判定ではなく、役ごとに一貫した「方向性」の規則を使う。
 */
export function possibleYaku(counts: number[]): string[] {
  if (counts.length !== 34) return [];

  const result: string[] = [];
  const shanten = calculateShanten(counts);
  const triplets = counts.filter((count) => count >= 3).length;
  const pairs = counts.filter((count) => count === 2).length;
  const honorCount = counts.slice(27).reduce((sum, count) => sum + count, 0);
  const numberedSuits = [0, 9, 18].filter((offset) =>
    counts.slice(offset, offset + 9).some((count) => count > 0)
  );

  if (shanten >= 0) result.push(YAKU.riichi);

  const hasTerminalOrHonor = counts.some(
    (count, index) =>
      count > 0 && (index >= 27 || index % 9 === 0 || index % 9 === 8)
  );
  if (!hasTerminalOrHonor) result.push(YAKU.tanyao);

  // 場風・自風は入力から分からないため、役牌字牌は三元牌だけを扱う。
  const hasDragonPair = counts.slice(31, 34).some((count) => count >= 2);
  if (triplets === 0 && !hasDragonPair) result.push(YAKU.pinfu);
  if (hasDragonPair) result.push(YAKU.yakuhai);

  if (pairs >= 4 && triplets === 0) result.push(YAKU.chiitoitsu);
  if (triplets >= 2 || pairs >= 3) result.push(YAKU.toitoi);

  if (numberedSuits.length === 1) {
    result.push(YAKU.honitsu);
    if (honorCount === 0) result.push(YAKU.chinitsu);
  }

  if (hasSanshokuShape(counts)) result.push(YAKU.sanshoku);
  if (hasIttsuuShape(counts)) result.push(YAKU.ittsuu);
  if (hasIipeikouShape(counts)) result.push(YAKU.iipeikou);

  return result;
}

/** 同じ順子帯について、各スーツに3牌中2牌以上がある。 */
function hasSanshokuShape(counts: number[]): boolean {
  for (let start = 0; start <= 6; start++) {
    if (
      [0, 9, 18].every((offset) =>
        [start, start + 1, start + 2].filter(
          (number) => counts[offset + number] > 0
        ).length >= 2
      )
    ) {
      return true;
    }
  }
  return false;
}

/** 同一スーツの123・456・789それぞれに、3牌中2牌以上がある。 */
function hasIttsuuShape(counts: number[]): boolean {
  return [0, 9, 18].some((offset) =>
    [0, 3, 6].every(
      (start) =>
        [start, start + 1, start + 2].filter(
          (number) => counts[offset + number] > 0
        ).length >= 2
    )
  );
}

/** 同一順子の3種すべてが2枚以上あり、二組の順子を作れる。 */
function hasIipeikouShape(counts: number[]): boolean {
  return [0, 9, 18].some((offset) => {
    for (let start = 0; start <= 6; start++) {
      if (
        counts[offset + start] >= 2 &&
        counts[offset + start + 1] >= 2 &&
        counts[offset + start + 2] >= 2
      ) {
        return true;
      }
    }
    return false;
  });
}
