#!/usr/bin/env node
/**
 * 麻雀牌SVG生成スクリプト
 * Mahjong Soul風シンプルデザイン / 軽量 / 小サイズでも視認性高い
 *
 * 生成先: public/tiles/{man,pin,sou,honor}/*.svg + public/tiles/back.svg
 */

const fs = require('fs');
const path = require('path');

const W = 34, H = 48;

// ── ベース牌 ──────────────────────────────────────────────
function tile(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <!-- shadow -->
  <rect x="2" y="3" width="31" height="44" rx="3" fill="#00000033"/>
  <!-- body -->
  <rect x="1" y="1" width="31" height="44" rx="3" fill="#f5f0e8" stroke="#8b7355" stroke-width="1.5"/>
  <!-- bevel highlight -->
  <rect x="2.5" y="2.5" width="28" height="41" rx="2" fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="0.8"/>
  ${content}
</svg>`.trim();
}

// ── 万子 ─────────────────────────────────────────────────
const MAN_KANJI = ['一','二','三','四','五','六','七','八','九'];

function manTile(n) {
  return tile(`
  <text x="17" y="29" text-anchor="middle" dominant-baseline="middle"
    font-family="'Noto Serif SC','Source Han Serif CK','HiraMinProN-W6','MS Mincho',serif"
    font-size="21" font-weight="900" fill="#dc2626">${MAN_KANJI[n-1]}</text>
  <text x="27" y="41" text-anchor="middle" dominant-baseline="middle"
    font-family="sans-serif" font-size="7" fill="#dc262666">万</text>`);
}

// ── 筒子 (青い円) ──────────────────────────────────────────
// PIN_POSITIONS[n] = { r, dots: [[cx, cy], ...] }
const PIN_POS = {
  1: { r: 7.5, dots: [[17, 24]] },
  2: { r: 5,   dots: [[17, 14], [17, 34]] },
  3: { r: 4.5, dots: [[10.5, 13], [17, 24], [23.5, 35]] },
  4: { r: 4,   dots: [[10.5, 13], [23.5, 13], [10.5, 35], [23.5, 35]] },
  5: { r: 3.5, dots: [[10.5, 12], [23.5, 12], [17, 24], [10.5, 36], [23.5, 36]] },
  6: { r: 3.5, dots: [[10.5, 12], [23.5, 12], [10.5, 24], [23.5, 24], [10.5, 36], [23.5, 36]] },
  7: { r: 3,   dots: [[17, 8], [10.5, 18], [23.5, 18], [10.5, 28], [23.5, 28], [10.5, 38], [23.5, 38]] },
  8: { r: 3,   dots: [[10.5, 8], [23.5, 8], [10.5, 19], [23.5, 19], [10.5, 29], [23.5, 29], [10.5, 40], [23.5, 40]] },
  9: { r: 3,   dots: [[10, 10], [17, 10], [24, 10], [10, 24], [17, 24], [24, 24], [10, 38], [17, 38], [24, 38]] },
};

function pinTile(n) {
  const { r, dots } = PIN_POS[n];
  const circles = dots.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1d4ed8" stroke="#1e3a8a" stroke-width="0.6"/>`
  ).join('\n  ');
  return tile(circles);
}

// ── 索子 (竹の断面: 緑のリング) ────────────────────────────
function souTile(n) {
  const { r, dots } = PIN_POS[n]; // 配置はpinと同じ
  const innerR = Math.max(r * 0.42, 1.2);
  const circles = dots.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#16a34a" stroke="#14532d" stroke-width="0.6"/>
  <circle cx="${cx}" cy="${cy}" r="${innerR}" fill="#bbf7d0"/>`
  ).join('\n  ');
  return tile(circles);
}

// ── 字牌 ─────────────────────────────────────────────────
const HONORS = [
  { name: 'east',  kanji: '東', color: '#1d4ed8' },
  { name: 'south', kanji: '南', color: '#dc2626' },
  { name: 'west',  kanji: '西', color: '#374151' },
  { name: 'north', kanji: '北', color: '#111827' },
  { name: 'white', kanji: '白', color: '#6b7280', border: true },
  { name: 'green', kanji: '発', color: '#16a34a' },
  { name: 'red',   kanji: '中', color: '#dc2626' },
];

function honorTile({ kanji, color, border }) {
  const frame = border
    ? `<rect x="7" y="7" width="20" height="30" rx="2" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`
    : '';
  return tile(`
  ${frame}
  <text x="17" y="28" text-anchor="middle" dominant-baseline="middle"
    font-family="'Noto Serif SC','Source Han Serif CK','HiraMinProN-W6','MS Mincho',serif"
    font-size="20" font-weight="900" fill="${color}">${kanji}</text>`);
}

// ── 裏牌 ─────────────────────────────────────────────────
function backTile() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect x="2" y="3" width="31" height="44" rx="3" fill="#00000033"/>
  <rect x="1" y="1" width="31" height="44" rx="3" fill="#166534" stroke="#14532d" stroke-width="1.5"/>
  <rect x="3" y="3" width="27" height="40" rx="2" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="0.8"/>
  <line x1="5"  y1="5"  x2="29" y2="41" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
  <line x1="29" y1="5"  x2="5"  y2="41" stroke="rgba(255,255,255,0.09)" stroke-width="1.2"/>
  <line x1="17" y1="4"  x2="17" y2="44" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <circle cx="17" cy="24" r="8" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1"/>
  <text x="17" y="28" text-anchor="middle" dominant-baseline="middle"
    font-family="serif" font-size="11" fill="rgba(255,255,255,0.28)">雀</text>
</svg>`.trim();
}

// ── ファイル書き出し ──────────────────────────────────────
const BASE = path.join(__dirname, 'public', 'tiles');
['man','pin','sou','honor'].forEach(d => fs.mkdirSync(path.join(BASE, d), { recursive: true }));

for (let n = 1; n <= 9; n++) {
  fs.writeFileSync(path.join(BASE, 'man', `${n}.svg`), manTile(n));
  fs.writeFileSync(path.join(BASE, 'pin', `${n}.svg`), pinTile(n));
  fs.writeFileSync(path.join(BASE, 'sou', `${n}.svg`), souTile(n));
}

HONORS.forEach(h => {
  fs.writeFileSync(path.join(BASE, 'honor', `${h.name}.svg`), honorTile(h));
});

fs.writeFileSync(path.join(BASE, 'back.svg'), backTile());

const total = 9*3 + 7 + 1;
console.log(`✓ ${total} SVG tiles generated in public/tiles/`);
