'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreSituation } = require('../src/visible-ukeire.cjs');
const { tileIndex } = require('../src/analyzer-core.cjs');

function hand() {
  const tiles = ['1m','2m','3m','4m','5m','6m','7s','8s','9s','3p','6p','7p','7p','8p'];
  return tiles.map((name, i) => ({id:`h${i}`,tile:{suit:name[1],number:Number(name[0])}}));
}
function publicTile(name, id, zone='discard') {
  return { id, zone, tile: { suit:name[1], number:Number(name[0]) } };
}
function fakeAnalysis(handEntries, candidates = [
  ['7p',0,['3p']], ['3p',0,['7p']], ['8p',1,['1m']]
]) {
  const original = handEntries.map((entry) => entry.tile);
  const counts = Array(34).fill(0);
  for (const tile of original) counts[tileIndex(tile)]++;
  return {hand: original, discardCandidates:candidates.map(([discard, shanten, effective]) => {
    const detail = effective.map((name) => ({tileIndex:tileIndex({suit:name[1],number:Number(name[0])}),remaining:4-counts[tileIndex({suit:name[1],number:Number(name[0])})]}));
    return {id:`discard-${discard}`,discardIndex:tileIndex({suit:discard[1],number:Number(discard[0])}),tile:{suit:discard[1],number:Number(discard[0])},
      resultShanten:shanten,ukeireDetail:detail,effectiveTileCount:detail.reduce((n,d)=>n+d.remaining,0)};
  })};
}
function evaluate(publicTiles=[], entries=hand(), analysis=fakeAnalysis(entries)) {
  return scoreSituation({hand:entries, publicTiles}, analysis);
}
function find(result, tile) { return result.candidates.find((c) => c.id === `discard-${tile}`); }

test('no public tiles: exact original candidate counts and ordering for scored hands', () => {
  const result=evaluate();
  assert.equal(find(result,'7p').baselineCount,3);
  assert.equal(find(result,'7p').visibleCount,3);
  assert.equal(find(result,'3p').visibleCount,2);
  assert.deepEqual(result.correctCandidateIds,['discard-7p']);
});
test('three discarded 3p reverse 7p versus 3p ranking (3→0, 2→2)', () => {
  const result=evaluate([publicTile('3p','d1'),publicTile('3p','d2'),publicTile('3p','d3')]);
  assert.equal(find(result,'7p').visibleCount,0);
  assert.equal(find(result,'3p').visibleCount,2);
  assert.deepEqual(result.correctCandidateIds,['discard-3p']);
});
test('irrelevant discards do not reduce another candidate; per-kind rather than uniform subtraction', () => {
  const result=evaluate([publicTile('1m','d1'),publicTile('1m','d2'),publicTile('1m','d3')]);
  assert.equal(find(result,'7p').visibleCount,3);
  assert.equal(find(result,'3p').visibleCount,2);
});
test('public discard, open meld and dora all consume physical tile copies exactly once', () => {
  const result=evaluate([publicTile('3p','d1','discard'),publicTile('3p','m1','meld'),publicTile('3p','dora','dora')]);
  assert.equal(find(result,'7p').visibleCount,0);
  assert.equal(find(result,'7p').details[0].publicVisible,3);
});
test('same physical tile in river and meld is rejected instead of deducted twice', () => {
  assert.throws(()=>evaluate([publicTile('3p','same'),publicTile('3p','same','meld')]), /duplicate physical tile ID/);
});
test('four-copy physical limit and inconsistent public tiles rejected', () => {
  assert.throws(()=>evaluate([publicTile('7p','a'),publicTile('7p','b'),publicTile('7p','c')]), /more than four visible/);
  assert.throws(()=>evaluate([publicTile('3p','a','hidden')]), /Invalid public tile zone/);
});
test('baseline forged with discarded tile returned to wall is rejected', () => {
  const entries=hand(); const analysis=fakeAnalysis(entries);
  analysis.discardCandidates[0].ukeireDetail[0].remaining=4;
  assert.throws(()=>evaluate([],entries,analysis), /Invalid analyzer ukeire detail/);
});
test('multiple answers for equal shanten and visible remaining; do not use kinds as tiebreak', () => {
  const entries=hand();
  const analysis=fakeAnalysis(entries,[['7p',0,['3p']],['3p',0,['7p','3p']]]);
  const result=evaluate([publicTile('3p','d1')],entries,analysis);
  // 7p: 3-1=2; 3p: (2+3)-1=4: not a tie; use a manually legal equal baseline fixture below.
  assert.deepEqual(result.correctCandidateIds,['discard-3p']);
  const tie=fakeAnalysis(entries,[['7p',0,['3p']],['3p',0,['7p']]]);
  const tied=evaluate([publicTile('3p','d2')],entries,tie);
  assert.deepEqual(tied.correctCandidateIds,['discard-3p','discard-7p']);
});
test('lower shanten outranks higher visible count', () => {
  const entries=hand(); const analysis=fakeAnalysis(entries,[['7p',0,['3p']],['3p',1,['3p','7p']]]);
  const result=evaluate([publicTile('3p','d1'),publicTile('3p','d2')],entries,analysis);
  assert.deepEqual(result.correctCandidateIds,['discard-7p']);
});
test('red fives share four-copy pool, but discard variants retain distinct IDs', () => {
  const entries=hand();
  entries[4].tile.isRed=true; // red 5m
  const analysis=fakeAnalysis(entries,[['5m',0,['7p']],['7p',0,['3p']]]);
  const result=evaluate([publicTile('3p','d1'),publicTile('3p','d2')],entries,analysis);
  assert.equal(find(result,'5m').visibleCount,2);
  assert.deepEqual(result.correctCandidateIds,['discard-5m']);
  assert.throws(()=>evaluate([publicTile('5m','a'),publicTile('5m','b'),publicTile('5m','c'),publicTile('5m','d')],entries,analysis),/more than four visible/);
});
test('missing IDs, analysis mismatch and invalid baseline totals are rejected',()=>{
  const entries=hand();
  assert.throws(()=>evaluate([],[{...entries[0],id:''},...entries.slice(1)]),/physical tile ID/);
  const mismatch=fakeAnalysis(entries); mismatch.hand[0]={suit:'p',number:1};
  assert.throws(()=>evaluate([],entries,mismatch),/does not match/);
  const invalid=fakeAnalysis(entries); invalid.discardCandidates[0].effectiveTileCount=9;
  assert.throws(()=>evaluate([],entries,invalid),/Invalid analyzer totals/);
});
