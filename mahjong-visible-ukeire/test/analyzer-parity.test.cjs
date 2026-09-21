'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeHand, tileIndex } = require('../src/analyzer-core.cjs');
const { scoreSituation } = require('../src/visible-ukeire.cjs');
// This suite deliberately fails if @kobalab/majiang-core is missing. No false-green skip.
function parse(text) {
  const tiles = [];
  const regex = /(\d+)([mpsz])/g;
  let match; let consumed = 0;
  while ((match = regex.exec(text))) {
    if (match.index !== consumed) throw new Error('Malformed hand');
    consumed = regex.lastIndex;
    for (const digit of match[1]) tiles.push({suit:match[2],number:digit==='0'?5:Number(digit),...(digit==='0'?{isRed:true}:{})});
  }
  if (consumed !== text.length) throw new Error('Malformed hand');
  return tiles;
}
const label = (tile) => `${tile.number}${tile.suit}`;
test('original production fixed fixture: all 11 discards match shanten / ukeire / kinds', () => {
  // Expected values from mahjong-analyzer/lib/mahjong/fixtures/reported-hand.json,
  // verified against both production @kobalab and the independent DFS implementation.
  const expected = {
    '2p':[2,55,17],'3s':[2,55,17],'6s':[2,54,16],'9s':[2,54,16],
    '5m':[2,48,14],'9m':[2,48,14],'4p':[2,31,9],
    '4m':[3,78,23],'7m':[3,74,22],'7s':[3,66,20],'8s':[3,66,20],
  };
  const result = analyzeHand(parse('444m579m244p36789s'));
  assert.equal(result.discardCandidates.length,11);
  for (const candidate of result.discardCandidates) {
    assert.deepEqual([candidate.resultShanten,candidate.effectiveTileCount,candidate.ukeireKinds], expected[label(candidate.tile)],label(candidate.tile));
  }
  const top = result.discardCandidates.filter((candidate) => candidate.resultShanten===2 && candidate.effectiveTileCount===55);
  assert.deepEqual(top.map((c) => label(c.tile)).sort(),['2p','3s']);
});
test('original analyzer baseline and visibility correction integration: 7p 3→0, 3p 2→2', () => {
  const tiles = parse('123m456m36778p789s');
  assert.equal(tiles.length,14);
  const analysis=analyzeHand(tiles);
  const original = (name) => analysis.discardCandidates.find((c) => label(c.tile) === name);
  assert.equal(original('7p').resultShanten,0);
  assert.equal(original('7p').effectiveTileCount,3);
  assert.deepEqual(original('7p').ukeireDetail,[{tileIndex:tileIndex({suit:'p',number:3}),remaining:3}]);
  assert.equal(original('3p').effectiveTileCount,2);
  const hand = tiles.map((tile,i)=>({id:`h${i}`,tile}));
  const publicTiles=[1,2,3].map((i)=>({id:`d${i}`,zone:'discard',tile:{suit:'p',number:3}}));
  const result=scoreSituation({hand,publicTiles},analysis);
  const lookup=(name)=>result.candidates.find((c)=>label(c.tile)===name);
  assert.equal(lookup('7p').visibleCount,0);
  assert.equal(lookup('3p').visibleCount,2);
  assert.deepEqual(result.correctCandidateIds,[original('3p').id]);
});
