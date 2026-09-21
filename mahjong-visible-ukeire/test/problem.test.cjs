'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createFixture,parseTiles,tileArt,exposureFor,candidateForTile,labelTile} = require('../src/problem.cjs');
const {tileIndex,tileCounts} = require('../src/analyzer-core.cjs');
const {scoreSituation} = require('../src/visible-ukeire.cjs');

test('fixture is a coherent, independently identified 14-hand and four-river scene',()=>{
  const scene=createFixture();
  assert.equal(scene.hand.length,14);
  assert.equal(Object.keys(scene.rivers).length,4);
  assert.ok(Object.values(scene.rivers).every(r=>r.length>0));
  assert.equal(scene.melds.length,1);
  assert.equal(scene.indicators.length,1);
  const all=[...scene.hand,...scene.publicTiles];
  assert.equal(new Set(all.map(t=>t.id)).size,all.length);
  const counts=tileCounts(all.map(t=>t.tile));
  assert.ok(counts.every(c=>c<=4));
  assert.equal(counts[tileIndex({suit:'p',number:3})],4);
  assert.equal(counts[tileIndex({suit:'p',number:7})],2);
});
test('published discard, exposed meld and dora represent precisely the scored public tiles',()=>{
  const scene=createFixture();
  assert.equal(scene.publicTiles.length,Object.values(scene.rivers).reduce((n,r)=>n+r.length,0)+scene.melds[0].tiles.length+scene.indicators.length);
  assert.equal(exposureFor(scene,tileIndex({suit:'p',number:3})),'南家の捨て牌 1枚、西家の捨て牌 1枚、北家の捨て牌 1枚');
  assert.equal(exposureFor(scene,tileIndex({suit:'s',number:4})),'北家の副露 1枚');
  assert.equal(exposureFor(scene,tileIndex({suit:'z',number:1})),'ドラ表示牌 1枚');
});
test('all tile faces resolve to original canonical SVG names, including red and honors',()=>{
  assert.equal(tileArt({suit:'p',number:5,isRed:true}),'/tiles/pin/5-red.svg');
  assert.equal(tileArt({suit:'z',number:7}),'/tiles/honor/red.svg');
  assert.equal(labelTile({suit:'p',number:5,isRed:true}),'5筒（赤）');
  assert.throws(()=>parseTiles('1p???'));
});
test('a tap resolves the exact engine candidate, not a separate answer-choice table',()=>{
  const scene=createFixture();
  const p3=scene.hand.find(({tile})=>tile.suit==='p'&&tile.number===3).tile;
  const mock={candidates:[{id:'discard-11-normal',discardIndex:11}]};
  assert.equal(candidateForTile(mock,p3).id,'discard-11-normal');
  assert.throws(()=>candidateForTile(mock,{suit:'p',number:7}));
});
test('full UI fixture connects to production engine and preserves reversal',()=>{
  const scene=createFixture();
  const scored=scoreSituation({hand:scene.hand,publicTiles:scene.publicTiles});
  const p3=candidateForTile(scored,{suit:'p',number:3});
  const p7=candidateForTile(scored,{suit:'p',number:7});
  assert.equal(p3.baselineCount,2);
  assert.equal(p3.visibleCount,2);
  assert.equal(p7.baselineCount,3);
  assert.equal(p7.visibleCount,0);
  assert.deepEqual(scored.correctCandidateIds,[p3.id]);
});
