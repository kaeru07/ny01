'use strict';

const { tileIndex, indexTile } = require('./analyzer-core.cjs');
const { scoreSituation } = require('./visible-ukeire.cjs');

const SEATS = ['self', 'right', 'top', 'left'];
const WINDS = {self: '東', right: '南', top: '西', left: '北'};
const NAMES = {m: '萬', p: '筒', s: '索'};
const HONORS = ['東', '南', '西', '北', '白', '發', '中'];

function parseTiles(notation) {
  const tiles = [];
  const regex = /(\d+)([mpsz])/g;
  let cursor = 0;
  let found;
  while ((found = regex.exec(notation))) {
    if (found.index !== cursor) throw new Error('Invalid tile notation');
    cursor = regex.lastIndex;
    for (const digit of found[1]) {
      const number = digit === '0' ? 5 : Number(digit);
      const tile = {suit: found[2], number, ...(digit === '0' ? {isRed: true} : {})};
      tileIndex(tile);
      tiles.push(tile);
    }
  }
  if (cursor !== notation.length) throw new Error('Invalid tile notation');
  return tiles;
}
function labelTile(tile) {
  return tile.suit === 'z' ? HONORS[tile.number - 1] : `${tile.number}${NAMES[tile.suit]}` + (tile.isRed ? '（赤）' : '');
}
function tileArt(tile) {
  const folder = {m: 'man',p:'pin',s:'sou',z:'honor'}[tile.suit];
  const name = tile.suit === 'z'
    ? ['east','south','west','north','white','green','red'][tile.number-1]
    : tile.isRed ? '5-red' : String(tile.number);
  return `/tiles/${folder}/${name}.svg`;
}
function createFixture() {
  // A real 14-tile tenpai hand: 7p cut waits on exhausted 3p; 3p cut waits on live 7p.
  const hand = parseTiles('123m456m36778p789s').map((tile,i)=>({id:`hand-${i}`,tile}));
  const riverText = {self:'49m2z',right:'3p25s',top:'3p16s',left:'3p28s'};
  const rivers = Object.fromEntries(SEATS.map(seat=>[
    seat,parseTiles(riverText[seat]).map((tile,i)=>({id:`river-${seat}-${i}`,tile,zone:'discard',seat}))
  ]));
  const melds = [{id:'meld-left-0',seat:'left',kind:'chi',tiles:parseTiles('456s')
    .map((tile,i)=>({id:`meld-left-0-${i}`,tile,zone:'meld',seat:'left'}))}];
  const indicators = parseTiles('1z').map((tile,i)=>({id:`indicator-${i}`,tile,zone:'dora',seat:null}));
  const publicTiles = [...SEATS.flatMap(seat=>rivers[seat]),...melds.flatMap(m=>m.tiles),...indicators];
  return {id:'visible-3p-reversal',round:'東1局',honba:0,turn:'東家',
    hand,rivers,melds,indicators,publicTiles,
    scores:{self:25000,right:25000,top:25000,left:25000}};
}
function evaluate(problem, originalAnalysis) {
  const scored = scoreSituation({hand:problem.hand, publicTiles:problem.publicTiles},originalAnalysis);
  if (scored.bestCount === 0) throw new Error('Fixture has zero live effective tiles');
  return scored;
}
function candidateForTile(scored,tile) {
  const id = `discard-${tileIndex(tile)}-${tile.isRed ? 'red' : 'normal'}`;
  const candidate = scored.candidates.find(c=>c.id===id);
  if (!candidate) throw new Error('Hand tile lacks a discard candidate');
  return candidate;
}
function exposureFor(problem,tileIndexValue) {
  const group = {};
  for (const visible of problem.publicTiles) {
    if (tileIndex(visible.tile) !== tileIndexValue) continue;
    const zone = visible.zone === 'dora' ? 'ドラ表示牌' :
      visible.zone === 'meld' ? `${WINDS[visible.seat]}家の副露` : `${WINDS[visible.seat]}家の捨て牌`;
    group[zone] = (group[zone] || 0) + 1;
  }
  return Object.entries(group).map(([location,count])=>`${location} ${count}枚`).join('、');
}
function candidateSummary(scored,problem,tile) {
  const candidate = candidateForTile(scored,tile);
  return {candidate, correct:scored.correctCandidateIds.includes(candidate.id), details: candidate.details.map(detail=>({
    ...detail, tile:indexTile(detail.tileIndex), location:exposureFor(problem,detail.tileIndex)
  }))};
}
module.exports = {SEATS,WINDS,parseTiles,labelTile,tileArt,createFixture,evaluate,candidateForTile,candidateSummary,exposureFor};
