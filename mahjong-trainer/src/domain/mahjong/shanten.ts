import type { TileIndex } from "@/types/mahjong";

// ============================================================
// 向聴数計算 (標準手・七対子・国士対応)
// 戻り値: -1=和了, 0=テンパイ, 1=一向聴, ...
// ============================================================

// 34種の牌のカウント配列に変換
function toCounts(tiles: TileIndex[]): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[t]++;
  return counts;
}

// 標準手の向聴数計算 (DFS)
function shantenNormal(counts: number[]): number {
  let best = 8;

  function update(mentsu: number, taatsu: number, jantou: number) {
    const capped = Math.min(taatsu, 4 - mentsu);
    const s = 8 - 2 * mentsu - capped - jantou;
    if (s < best) best = s;
  }

  function solve(pos: number, mentsu: number, taatsu: number, jantou: number) {
    update(mentsu, taatsu, jantou);
    if (best === -1) return;

    // 空のポジションをスキップ
    while (pos < 34 && counts[pos] === 0) pos++;
    if (pos >= 34) return;

    const suit = Math.floor(pos / 9);
    const rank = pos % 9;

    // 刻子 (3枚)
    if (counts[pos] >= 3) {
      counts[pos] -= 3;
      solve(pos, mentsu + 1, taatsu, jantou);
      counts[pos] += 3;
    }

    // 順子 (数牌のみ: rank <= 6 で pos+1,+2 が存在)
    if (suit < 3 && rank <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      counts[pos + 2]--;
      solve(pos, mentsu + 1, taatsu, jantou);
      counts[pos]++;
      counts[pos + 1]++;
      counts[pos + 2]++;
    }

    // 雀頭
    if (counts[pos] >= 2 && jantou === 0) {
      counts[pos] -= 2;
      solve(pos, mentsu, taatsu, 1);
      counts[pos] += 2;
    }

    // 対子塔子 (雀頭なしで2枚対子)
    if (counts[pos] >= 2) {
      counts[pos] -= 2;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos] += 2;
    }

    // 嵌張塔子 (kanchan: 1-3, 2-4 ...)
    if (suit < 3 && rank <= 6 && counts[pos + 2] > 0) {
      counts[pos]--;
      counts[pos + 2]--;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos]++;
      counts[pos + 2]++;
    }

    // 両面/辺張塔子 (consecutive)
    if (suit < 3 && rank <= 7 && counts[pos + 1] > 0) {
      counts[pos]--;
      counts[pos + 1]--;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos]++;
      counts[pos + 1]++;
    }

    // このポジションをスキップ (残牌は孤立牌として無視)
    solve(pos + 1, mentsu, taatsu, jantou);
  }

  const c = [...counts];
  solve(0, 0, 0, 0);
  return best;
}

// 七対子の向聴数
function shantenChiitoitsu(counts: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  return 6 - pairs;
}

// 国士無双の向聴数
function shantenKokushi(counts: number[]): number {
  const terminals = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  let kinds = 0;
  let hasPair = false;
  for (const t of terminals) {
    if (counts[t] > 0) kinds++;
    if (counts[t] >= 2) hasPair = true;
  }
  return 13 - kinds - (hasPair ? 1 : 0);
}

// 総合向聴数 (最小値)
export function calculateShanten(tiles: TileIndex[]): number {
  const counts = toCounts(tiles);
  return Math.min(
    shantenNormal(counts),
    shantenChiitoitsu(counts),
    shantenKokushi(counts)
  );
}

// テンパイかどうか (13枚入力)
export function isTenpai(tiles: TileIndex[]): boolean {
  return calculateShanten(tiles) === 0;
}

// 和了かどうか (14枚入力)
export function isWinningHand(tiles: TileIndex[]): boolean {
  return calculateShanten(tiles) === -1;
}

// テンパイ時の待ち牌一覧を返す (13枚入力)
export function getTenpaiWaits(tiles: TileIndex[]): TileIndex[] {
  if (calculateShanten(tiles) !== 0) return [];
  const waits: TileIndex[] = [];
  for (let i = 0; i < 34; i++) {
    if (isWinningHand([...tiles, i])) {
      waits.push(i);
    }
  }
  return waits;
}

// 14枚からどれを切ればテンパイになるか返す
// 戻り値: { discard: TileIndex, waits: TileIndex[] }[]
export function getEffectiveDiscards(
  tiles: TileIndex[]
): { discard: TileIndex; waits: TileIndex[]; shanten: number }[] {
  const results: { discard: TileIndex; waits: TileIndex[]; shanten: number }[] = [];
  const seen = new Set<TileIndex>();

  for (let i = 0; i < tiles.length; i++) {
    const discarded = tiles[i];
    if (seen.has(discarded)) continue;
    seen.add(discarded);

    const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 1)];
    const s = calculateShanten(remaining);
    const waits = s === 0 ? getTenpaiWaits(remaining) : [];
    results.push({ discard: discarded, waits, shanten: s });
  }

  return results.sort((a, b) => a.shanten - b.shanten);
}
