#!/usr/bin/env node
/**
 * 麻雀牌SVG生成スクリプト v2
 * 実牌寄りデザイン
 * - 索子: 竹茎デザイン (1索=鳥, 2-9索=竹茎)
 * - 萬子: 萬を大きく中央配置
 * - 赤5: man/pin/sou の赤5牌追加
 */

const fs = require('fs');
const path = require('path');

const W = 34, H = 48;

// ── ベース牌 ──────────────────────────────────────────────────
function tile(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <!-- shadow -->
  <rect x="2" y="3" width="31" height="44" rx="3" fill="#00000028"/>
  <!-- body: やや白めの象牙色 -->
  <rect x="1" y="1" width="31" height="44" rx="3" fill="#faf7f0" stroke="#9b8566" stroke-width="1.4"/>
  <!-- top-left bevel -->
  <rect x="2.5" y="2.5" width="28" height="41" rx="2" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="0.7"/>
  ${content}
</svg>`.trim();
}

// ── 萬子 (実牌寄り: 萬を中央下に配置) ──────────────────────────
const MAN_KANJI = ['一','二','三','四','五','六','七','八','九'];

function manTile(n, red = false) {
  const numColor  = red ? '#e11d48' : '#dc2626';
  const wanColor  = red ? '#e11d48cc' : '#dc2626bb';
  return tile(`
  <text x="17" y="23" text-anchor="middle" dominant-baseline="middle"
    font-family="'Noto Serif SC','Source Han Serif CK','HiraMinProN-W6','MS Mincho',serif"
    font-size="21" font-weight="900" fill="${numColor}">${MAN_KANJI[n-1]}</text>
  <text x="17" y="39" text-anchor="middle" dominant-baseline="middle"
    font-family="'Noto Serif SC','Source Han Serif CK','HiraMinProN-W6','MS Mincho',serif"
    font-size="10" font-weight="700" fill="${wanColor}">萬</text>
  ${red ? '<circle cx="5" cy="6" r="3" fill="#e11d48"/>' : ''}`);
}

// ── 筒子 (青い円, 変更なし) ────────────────────────────────────
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

function pinTile(n, red = false) {
  const fill   = red ? '#e11d48' : '#1d4ed8';
  const stroke = red ? '#be123c' : '#1e3a8a';
  const { r, dots } = PIN_POS[n];
  const circles = dots.map(([cx, cy]) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="0.6"/>`
  ).join('\n  ');
  const redDot = red ? '<circle cx="5" cy="6" r="3" fill="#e11d48"/>' : '';
  return tile(circles + '\n  ' + redDot);
}

// ── 索子: 竹茎デザイン ─────────────────────────────────────────

// 竹茎1本を描画
// cx,cy = 茎の中心, w = 幅, h = 高さ
function bambooStalk(cx, cy, w, h, red = false) {
  const hw   = w / 2;
  const halfH = h / 2;
  const bodyColor  = red ? '#9f1239' : '#166534';
  const jointColor = red ? '#e11d48' : '#22c55e';
  const lightColor = red ? '#fda4af' : '#bbf7d0';
  const midH = Math.max(halfH - 3, 2);

  return `
  <!-- stalk body -->
  <rect x="${cx-hw}" y="${cy-halfH}" width="${w}" height="${h}" rx="${hw}" fill="${bodyColor}"/>
  <!-- joint ring -->
  <ellipse cx="${cx}" cy="${cy}" rx="${hw+1.5}" ry="2.3" fill="${jointColor}"/>
  <!-- upper highlight -->
  <rect x="${cx-hw+1}" y="${cy-halfH+1.5}" width="${w-2}" height="${midH}" rx="${(w-2)/2}" fill="${lightColor}" opacity="0.35"/>`;
}

// 1索: 鳥デザイン (簡略化した横向き鳥)
function sou1Bird() {
  return `
  <!-- 1索: 鳥 -->
  <!-- body -->
  <ellipse cx="19" cy="27" rx="9" ry="6.5" fill="#166534"/>
  <!-- neck+head area (merged) -->
  <ellipse cx="11.5" cy="22.5" rx="5.5" ry="5" fill="#166534"/>
  <!-- smooth neck connector -->
  <path d="M10,25 Q14,24 16,28 Q14,30 19,30 Q13,31 10,28Z" fill="#166534"/>
  <!-- beak -->
  <polygon points="6,22 10.5,20 10.5,25" fill="#ca8a04"/>
  <!-- eye -->
  <circle cx="9" cy="21" r="1.5" fill="white"/>
  <circle cx="9.1" cy="21" r="0.75" fill="#111"/>
  <!-- wing shading -->
  <ellipse cx="20" cy="26" rx="7" ry="4" fill="#14532d" opacity="0.5" transform="rotate(-12,20,26)"/>
  <!-- wing highlight -->
  <ellipse cx="18" cy="25" rx="4" ry="2.5" fill="#22c55e" opacity="0.35" transform="rotate(-12,18,25)"/>
  <!-- tail -->
  <path d="M27,26 C31,21 33,29 29,33 C28,30 27,26 27,26Z" fill="#14532d"/>
  <path d="M27,27 C30,24 31,30 28,32 C27.5,30 27,27 27,27Z" fill="#166534"/>
  <!-- left leg -->
  <line x1="16" y1="33" x2="14" y2="40" stroke="#14532d" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="11" y2="42" stroke="#14532d" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="15" y2="43" stroke="#14532d" stroke-width="1.2" stroke-linecap="round"/>
  <!-- right leg -->
  <line x1="20" y1="33" x2="22" y2="40" stroke="#14532d" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="19" y2="42" stroke="#14532d" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="24" y2="43" stroke="#14532d" stroke-width="1.2" stroke-linecap="round"/>`;
}

// n別の竹茎サイズ (PIN_POSの配置に合わせた高さ/幅)
// 列が2本のとき幅は6、3本のとき幅は5
const SOU_DIMS = {
  1: { w: 7,  h: 28 }, // 鳥 (未使用)
  2: { w: 6,  h: 16 }, // 縦2本, y間隔20
  3: { w: 6,  h: 16 }, // 斜め, 衝突なし
  4: { w: 6,  h: 14 }, // 2×2, y間隔22
  5: { w: 5,  h: 10 }, // y間隔12
  6: { w: 5,  h: 10 }, // y間隔12
  7: { w: 5,  h: 8  }, // y間隔10
  8: { w: 5,  h: 8  }, // y間隔11
  9: { w: 5,  h: 9  }, // y間隔14
};

function souTile(n, red = false) {
  if (n === 1 && !red) {
    return tile(sou1Bird());
  }
  if (n === 1 && red) {
    // 赤1索: 鳥を赤で
    return tile(`
  <!-- 赤1索: 鳥 -->
  <ellipse cx="19" cy="27" rx="9" ry="6.5" fill="#991b1b"/>
  <ellipse cx="11.5" cy="22.5" rx="5.5" ry="5" fill="#991b1b"/>
  <path d="M10,25 Q14,24 16,28 Q14,30 19,30 Q13,31 10,28Z" fill="#991b1b"/>
  <polygon points="6,22 10.5,20 10.5,25" fill="#ca8a04"/>
  <circle cx="9" cy="21" r="1.5" fill="white"/>
  <circle cx="9.1" cy="21" r="0.75" fill="#111"/>
  <ellipse cx="20" cy="26" rx="7" ry="4" fill="#7f1d1d" opacity="0.5" transform="rotate(-12,20,26)"/>
  <path d="M27,26 C31,21 33,29 29,33 C28,30 27,26 27,26Z" fill="#7f1d1d"/>
  <line x1="16" y1="33" x2="14" y2="40" stroke="#7f1d1d" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="11" y2="42" stroke="#7f1d1d" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="15" y2="43" stroke="#7f1d1d" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="20" y1="33" x2="22" y2="40" stroke="#7f1d1d" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="19" y2="42" stroke="#7f1d1d" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="24" y2="43" stroke="#7f1d1d" stroke-width="1.2" stroke-linecap="round"/>
  <circle cx="5" cy="6" r="3" fill="#e11d48"/>`);
  }

  const { w, h } = SOU_DIMS[n];
  const { dots } = PIN_POS[n];
  const stalks = dots.map(([cx, cy]) => bambooStalk(cx, cy, w, h, red)).join('');
  const redDot  = red ? '<circle cx="5" cy="6" r="3" fill="#e11d48"/>' : '';
  return tile(stalks + '\n  ' + redDot);
}

// ── 字牌 ──────────────────────────────────────────────────────
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

// ── 裏牌 ──────────────────────────────────────────────────────
function backTile() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect x="2" y="3" width="31" height="44" rx="3" fill="#00000028"/>
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

// ── ファイル書き出し ───────────────────────────────────────────
const BASE = path.join(__dirname, 'public', 'tiles');
['man','pin','sou','honor'].forEach(d => fs.mkdirSync(path.join(BASE, d), { recursive: true }));

// 通常牌
for (let n = 1; n <= 9; n++) {
  fs.writeFileSync(path.join(BASE, 'man', `${n}.svg`), manTile(n));
  fs.writeFileSync(path.join(BASE, 'pin', `${n}.svg`), pinTile(n));
  fs.writeFileSync(path.join(BASE, 'sou', `${n}.svg`), souTile(n));
}

// 赤5牌
fs.writeFileSync(path.join(BASE, 'man', '5-red.svg'), manTile(5, true));
fs.writeFileSync(path.join(BASE, 'pin', '5-red.svg'), pinTile(5, true));
fs.writeFileSync(path.join(BASE, 'sou', '5-red.svg'), souTile(5, true));

// 字牌
HONORS.forEach(h => {
  fs.writeFileSync(path.join(BASE, 'honor', `${h.name}.svg`), honorTile(h));
});

fs.writeFileSync(path.join(BASE, 'back.svg'), backTile());

const total = 9*3 + 3 + 7 + 1;
console.log(`✓ ${total} SVG tiles generated in public/tiles/`);
console.log('  - 万子: 一〜九 + 赤5');
console.log('  - 筒子: 1〜9 + 赤5');
console.log('  - 索子: 1〜9 (1索=鳥, 2-9索=竹茎) + 赤5');
console.log('  - 字牌: 東南西北白発中');
console.log('  - 裏牌');
