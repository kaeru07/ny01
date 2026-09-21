'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../public/tiles');

test('canonical FluffyStuff collection: all 39 SVGs and source / CC0 notices are bundled',()=>{
  const paths=['front.svg','back.svg',...['man','pin','sou'].flatMap(suit=>[
    ...Array.from({length:9},(_,i)=>`${suit}/${i+1}.svg`),`${suit}/5-red.svg`
  ]),...['east','south','west','north','white','green','red'].map(s=>`honor/${s}.svg`)];
  assert.equal(paths.length,39);
  for(const relative of paths){
    const svg=fs.readFileSync(path.join(root,relative),'utf8');
    assert.match(svg,/<svg\b/);
    assert.match(svg,/viewBox="0 0 300 400"/);
    assert.doesNotMatch(svg,/<(?:image|text|tspan)\b/);
  }
  const source=fs.readFileSync(path.join(root,'SOURCE.md'),'utf8');
  const license=fs.readFileSync(path.join(root,'FLUFFYSTUFF_LICENSE.md'),'utf8');
  assert.match(source,/FluffyStuff\/riichi-mahjong-tiles/);
  assert.match(license,/public domain/i);
  assert.match(license,/creativecommons\.org\/publicdomain\/zero\/1\.0/);
});
