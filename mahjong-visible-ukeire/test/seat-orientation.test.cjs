'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const root = join(__dirname, '..');
const css = readFileSync(join(root, 'app/globals.css'), 'utf8');
const page = readFileSync(join(root, 'app/page.jsx'), 'utf8');

test('opposite and own seats retain their original tile orientations', () => {
  assert.match(page, /upsideDown=\{seat==='top'\}/);
  assert.match(css, /\.tile-opposite \.tile-rotator\{transform:rotate\(180deg\)\}/);
  assert.match(page, /sideways=\{seat==='left'\|\|seat==='right'\}/);
});

test('left seats rotate tiles +90 degrees and right seats 270 degrees', () => {
  assert.match(css, /\.tile-side \.tile-rotator\{[^}]*rotate\(90deg\)\}/);
  assert.match(css, /\.opponent-right \.tile-side \.tile-rotator,\.river-right \.tile-side \.tile-rotator\{[^}]*rotate\(270deg\)\}/);
  assert.doesNotMatch(css, /\.opponent-left \.tile-side \.tile-rotator[^}]*rotate\(270deg\)/);
});

test('both side rivers use six tiles per vertical run and at most three columns for 18 discards', () => {
  const rule = css.match(/\.river-left \.river-tiles,\.river-right \.river-tiles\{([^}]*)\}/);
  assert.ok(rule, 'both side rivers must have a shared explicit grid layout');
  assert.match(rule[1], /grid-template-columns:repeat\(3,max-content\)/);
  assert.match(rule[1], /grid-template-rows:repeat\(6,max-content\)/);
  assert.match(rule[1], /grid-auto-flow:column/);
  assert.equal(Math.ceil(18 / 6), 3);
  assert.match(page, /entries\.map\(entry=>/);
});
