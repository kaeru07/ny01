'use strict';
// Extracted hand-efficiency path from kaeru07/mahjong-analyzer, lib/mahjong/analyzer.ts
// and adapter/kobalab.ts at commit 6ddbba0a2985be261e37eec02d2b379aa5ab370c.
// Scoring, yaku and original app UI intentionally remain in the original app.
function core() { return require('@kobalab/majiang-core'); }
const SUITS = ['m', 'p', 's', 'z'];

function tileIndex(tile) {
  if (!tile || !SUITS.includes(tile.suit) || !Number.isInteger(tile.number) ||
      tile.number < 1 || tile.number > (tile.suit === 'z' ? 7 : 9) ||
      (tile.isRed !== undefined && typeof tile.isRed !== 'boolean') ||
      (tile.isRed && (tile.suit === 'z' || tile.number !== 5))) {
    throw new Error('Invalid tile');
  }
  return SUITS.indexOf(tile.suit) * 9 + tile.number - 1;
}
function indexTile(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 34) throw new Error('Invalid tile index');
  const suit = index < 27 ? SUITS[Math.floor(index / 9)] : 'z';
  return { suit, number: index - SUITS.indexOf(suit) * 9 + 1 };
}
function tileCounts(tiles) {
  const counts = Array(34).fill(0);
  for (const tile of tiles) {
    const index = tileIndex(tile);
    if (++counts[index] > 4) throw new Error('More than four copies of one tile');
  }
  return counts;
}
function coreString(counts) {
  return SUITS.map((suit, suitIndex) => {
    let digits = '';
    for (let i = 0; i < (suit === 'z' ? 7 : 9); i++) digits += String(i + 1).repeat(counts[suitIndex * 9 + i]);
    return digits ? suit + digits : '';
  }).join('');
}
function libraryIndex(value) {
  const suit = value[0];
  const number = Number(value[1] === '0' ? '5' : value[1]);
  return tileIndex({ suit, number });
}
function shanten(counts) { const { Shoupai, Util } = core(); return Util.xiangting(Shoupai.fromString(coreString(counts))); }
function improvingIndices(counts) {
  const { Shoupai, Util } = core();
  return (Util.tingpai(Shoupai.fromString(coreString(counts))) ?? [])
    .map(libraryIndex).filter((index) => counts[index] < 4);
}
function analyzeHand(hand) {
  if (!Array.isArray(hand) || hand.length !== 14) throw new Error('Exactly 14 tiles are required');
  const known = tileCounts(hand);
  const candidates = [];
  for (let discardIndex = 0; discardIndex < 34; discardIndex++) {
    if (!known[discardIndex]) continue;
    const isFive = discardIndex < 27 && discardIndex % 9 === 4;
    const redCount = isFive ? hand.filter((tile) => tileIndex(tile) === discardIndex && tile.isRed).length : 0;
    const normalCount = known[discardIndex] - redCount;
    const variants = isFive ? [...(normalCount ? [false] : []), ...(redCount ? [true] : [])] : [false];
    for (const isRed of variants) {
      const after = [...known];
      after[discardIndex]--;
      const ukeireDetail = improvingIndices(after).map((tileIndex) => ({
        tileIndex, remaining: 4 - known[tileIndex],
      }));
      candidates.push({
        id: `discard-${discardIndex}-${isRed ? 'red' : 'normal'}`, discardIndex,
        tile: { ...indexTile(discardIndex), ...(isRed ? { isRed: true } : {}) },
        resultShanten: shanten(after), ukeireDetail,
        effectiveTileCount: ukeireDetail.reduce((n, entry) => n + entry.remaining, 0),
        ukeireKinds: ukeireDetail.length,
      });
    }
  }
  candidates.sort((a, b) => a.resultShanten - b.resultShanten ||
    b.effectiveTileCount - a.effectiveTileCount || b.ukeireKinds - a.ukeireKinds);
  return { hand, discardCandidates: candidates };
}
module.exports = { analyzeHand, tileCounts, tileIndex, indexTile };
