'use strict';
const { analyzeHand, tileCounts, tileIndex } = require('./analyzer-core.cjs');
const ZONES = new Set(['discard', 'meld', 'dora', 'kan', 'other']);

/**
 * A state contains 14 physical hand tiles and public tiles, each with a unique id.
 * A tile moved from a river into an open meld appears ONCE, in its current zone.
 * Hidden opponent hands, ura-dora and unknown wall tiles MUST NOT be supplied.
 * @param {{hand: Array<{id:string,tile:object}>,publicTiles: Array<{id:string,tile:object,zone:string}>}} state
 * @param {object} [existingAnalysis] - optional original analyzeHand result for adapter parity.
 */
function scoreSituation(state, existingAnalysis) {
  if (!state || !Array.isArray(state.hand) || state.hand.length !== 14 ||
      !Array.isArray(state.publicTiles)) throw new Error('Invalid situation: 14 hand tiles and publicTiles required');
  const ids = new Set();
  const checkId = (id) => {
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) throw new Error('Missing/duplicate physical tile ID');
    ids.add(id);
  };
  for (const entry of state.hand) {
    if (!entry) throw new Error('Invalid hand entry');
    checkId(entry.id);
  }
  const handTiles = state.hand.map(({ tile }) => tile);
  const handCounts = tileCounts(handTiles);
  const publicCounts = Array(34).fill(0);
  for (const entry of state.publicTiles) {
    if (!entry || !ZONES.has(entry.zone)) throw new Error('Invalid public tile zone');
    checkId(entry.id);
    publicCounts[tileIndex(entry.tile)]++;
  }
  for (let index = 0; index < 34; index++) {
    if (handCounts[index] + publicCounts[index] > 4) throw new Error('Impossible tile count: more than four visible');
  }
  const analysis = existingAnalysis ?? analyzeHand(handTiles);
  if (!analysis || !Array.isArray(analysis.hand) || !Array.isArray(analysis.discardCandidates) ||
      !analysis.discardCandidates.length || JSON.stringify(tileCounts(analysis.hand)) !== JSON.stringify(handCounts)) {
    throw new Error('Analysis does not match the hand');
  }
  const candidateIds = new Set();
  const candidates = analysis.discardCandidates.map((candidate) => {
    if (typeof candidate.id !== 'string' || candidateIds.has(candidate.id)) throw new Error('Duplicate or missing candidate ID');
    candidateIds.add(candidate.id);
    if (!Number.isInteger(candidate.discardIndex) || candidate.discardIndex < 0 ||
        candidate.discardIndex >= 34 || !handCounts[candidate.discardIndex] ||
        !Number.isInteger(candidate.resultShanten) || tileIndex(candidate.tile) !== candidate.discardIndex ||
        (candidate.tile.isRed && !handTiles.some((t) => tileIndex(t) === candidate.discardIndex && t.isRed)) ||
        !Array.isArray(candidate.ukeireDetail) || !candidate.ukeireDetail.length && candidate.effectiveTileCount !== 0) {
      throw new Error('Invalid analyzer candidate');
    }
    const seen = new Set();
    const details = candidate.ukeireDetail.map(({ tileIndex: index, remaining: baseline }) => {
      if (!Number.isInteger(index) || index < 0 || index >= 34 || seen.has(index) ||
          !Number.isInteger(baseline) || baseline !== 4 - handCounts[index]) {
        throw new Error('Invalid analyzer ukeire detail');
      }
      seen.add(index);
      return { tileIndex: index, baseline, publicVisible: publicCounts[index], remaining: baseline - publicCounts[index] };
    });
    const baselineCount = details.reduce((n, d) => n + d.baseline, 0);
    if (baselineCount !== candidate.effectiveTileCount || details.some((d) => d.remaining < 0)) {
      throw new Error('Invalid analyzer totals or negative remaining tiles');
    }
    return { id: candidate.id, discardIndex: candidate.discardIndex, tile: candidate.tile,
      resultShanten: candidate.resultShanten, baselineCount,
      visibleCount: details.reduce((n, d) => n + d.remaining, 0), details };
  });
  candidates.sort((a, b) => a.resultShanten - b.resultShanten ||
    b.visibleCount - a.visibleCount || a.discardIndex - b.discardIndex ||
    Number(Boolean(a.tile.isRed)) - Number(Boolean(b.tile.isRed)));
  const bestShanten = candidates[0].resultShanten;
  const bestCount = candidates.filter((c) => c.resultShanten === bestShanten)[0].visibleCount;
  const correctCandidateIds = candidates.filter((c) => c.resultShanten === bestShanten &&
    c.visibleCount === bestCount).map((c) => c.id);
  return { candidates, correctCandidateIds, bestShanten, bestCount };
}
module.exports = { scoreSituation };
