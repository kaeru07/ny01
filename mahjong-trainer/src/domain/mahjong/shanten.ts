import type { TileIndex } from "@/types/mahjong";

function toCounts(tiles: TileIndex[]): number[] {
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[t]++;
  return counts;
}

function shantenNormal(counts: number[], fixedMelds = 0): number {
  let best = 8 - fixedMelds * 2;

  function update(mentsu: number, taatsu: number, jantou: number) {
    const capped = Math.min(taatsu, 4 - mentsu);
    const s = 8 - 2 * mentsu - capped - jantou;
    if (s < best) best = s;
  }

  function solve(pos: number, mentsu: number, taatsu: number, jantou: number) {
    update(mentsu, taatsu, jantou);
    if (best === -1) return;
    while (pos < 34 && counts[pos] === 0) pos++;
    if (pos >= 34) return;

    const suit = Math.floor(pos / 9);
    const rank = pos % 9;

    if (counts[pos] >= 3) {
      counts[pos] -= 3;
      solve(pos, mentsu + 1, taatsu, jantou);
      counts[pos] += 3;
    }
    if (suit < 3 && rank <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
      counts[pos]--; counts[pos + 1]--; counts[pos + 2]--;
      solve(pos, mentsu + 1, taatsu, jantou);
      counts[pos]++; counts[pos + 1]++; counts[pos + 2]++;
    }
    if (counts[pos] >= 2 && jantou === 0) {
      counts[pos] -= 2;
      solve(pos, mentsu, taatsu, 1);
      counts[pos] += 2;
    }
    if (counts[pos] >= 2) {
      counts[pos] -= 2;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos] += 2;
    }
    if (suit < 3 && rank <= 6 && counts[pos + 2] > 0) {
      counts[pos]--; counts[pos + 2]--;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos]++; counts[pos + 2]++;
    }
    if (suit < 3 && rank <= 7 && counts[pos + 1] > 0) {
      counts[pos]--; counts[pos + 1]--;
      solve(pos, mentsu, taatsu + 1, jantou);
      counts[pos]++; counts[pos + 1]++;
    }
    solve(pos + 1, mentsu, taatsu, jantou);
  }

  solve(0, fixedMelds, 0, 0);
  return best;
}

function shantenChiitoitsu(counts: number[]): number {
  let pairs = 0;
  for (let i = 0; i < 34; i++) if (counts[i] >= 2) pairs++;
  return 6 - pairs;
}

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

export function calculateShanten(tiles: TileIndex[]): number {
  const counts = toCounts(tiles);
  return Math.min(shantenNormal(counts), shantenChiitoitsu(counts), shantenKokushi(counts));
}

export function calculateShantenWithMelds(tiles: TileIndex[], fixedMelds: number): number {
  if (fixedMelds <= 0) return calculateShanten(tiles);
  return shantenNormal(toCounts(tiles), Math.min(4, fixedMelds));
}

export function isTenpai(tiles: TileIndex[]): boolean {
  return calculateShanten(tiles) === 0;
}

export function isTenpaiWithMelds(tiles: TileIndex[], fixedMelds: number): boolean {
  return calculateShantenWithMelds(tiles, fixedMelds) === 0;
}

export function isWinningHand(tiles: TileIndex[]): boolean {
  return calculateShanten(tiles) === -1;
}

export function isWinningHandWithMelds(tiles: TileIndex[], fixedMelds: number): boolean {
  return calculateShantenWithMelds(tiles, fixedMelds) === -1;
}

export function getTenpaiWaits(tiles: TileIndex[]): TileIndex[] {
  if (calculateShanten(tiles) !== 0) return [];
  const waits: TileIndex[] = [];
  for (let i = 0; i < 34; i++) if (isWinningHand([...tiles, i])) waits.push(i);
  return waits;
}

export function getTenpaiWaitsWithMelds(tiles: TileIndex[], fixedMelds: number): TileIndex[] {
  if (calculateShantenWithMelds(tiles, fixedMelds) !== 0) return [];
  const waits: TileIndex[] = [];
  for (let i = 0; i < 34; i++) {
    if (isWinningHandWithMelds([...tiles, i], fixedMelds)) waits.push(i);
  }
  return waits;
}

export function getCurrentWaits(
  hand: TileIndex[],
  drawnTile: TileIndex | null,
  fixedMelds = 0
): TileIndex[] {
  const tiles = drawnTile === null ? [...hand] : [...hand, drawnTile];
  if (tiles.length % 3 === 1) return getTenpaiWaitsWithMelds(tiles, fixedMelds);
  if (tiles.length % 3 !== 2) return [];

  const waits = new Set<TileIndex>();
  const seen = new Set<TileIndex>();
  for (let i = 0; i < tiles.length; i++) {
    const discard = tiles[i];
    if (seen.has(discard)) continue;
    seen.add(discard);
    const remaining = [...tiles.slice(0, i), ...tiles.slice(i + 1)];
    for (const wait of getTenpaiWaitsWithMelds(remaining, fixedMelds)) waits.add(wait);
  }
  return [...waits].sort((a, b) => a - b);
}

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
