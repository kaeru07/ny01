#!/usr/bin/env node
/**
 * 麻雀牌SVG生成スクリプト v3 — 実牌寄りデザイン
 *
 * - 牌枠: viewBox に対して中央配置。全種類で余白・線幅・角丸を統一。
 * - 萬子/字牌: Noto Serif CJK JP（SIL OFL）のグリフ輪郭を SVG パスとして埋め込む。
 *   → 端末フォントに依存せず、明朝体の実牌らしい字形で描画される。
 *     OFL はアウトラインの埋め込み/改変を許可（予約名 "Noto" を名乗らなければ可）。
 *   グリフパスは tools/glyphs.json（fontTools で抽出）から読む。
 * - 筒子: ベタ点ではなく輪（コイン）状。同心円で実牌の銭形に寄せる。
 * - 索子: 節のある竹。1索は鳥。
 * - 字牌の色: 東南西北=黒 / 發=緑 / 中=赤 / 白=青枠（日本の一般的な配色）。
 *
 * 変更後は `node generate-tiles.js` で public/tiles/*.svg を再生成する。
 */

const fs = require('fs');
const path = require('path');

const W = 34, H = 48;
const GLYPHS = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools', 'glyphs.json'), 'utf8'));
const UPEM = GLYPHS.unitsPerEm;

// 牌の面の色
const IVORY = '#f7f4ea';
const IVORY_EDGE = '#d8d0bc';
const FRAME = '#b7a888';

// ── ベース牌（中央配置・統一枠）───────────────────────────────
function tile(content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <!-- 影 -->
  <rect x="2.4" y="3" width="29.6" height="43" rx="4" fill="#0000001f"/>
  <!-- 側面(厚み) -->
  <rect x="2" y="2.4" width="30" height="44" rx="4" fill="${IVORY_EDGE}"/>
  <!-- 面 -->
  <rect x="2" y="1.6" width="30" height="43.2" rx="4" fill="${IVORY}" stroke="${FRAME}" stroke-width="0.8"/>
  <!-- 面のハイライト -->
  <rect x="3.4" y="3" width="27.2" height="40" rx="3" fill="none" stroke="#ffffffcc" stroke-width="0.7"/>
  ${content}
</svg>`.trim();
}

// ── グリフ埋め込み（明朝アウトライン）─────────────────────────
// char を (cx,cy) 中心・em サイズ em(px) で配置。バウンディングボックス中心で厳密センタリング。
function glyph(char, cx, cy, em, color) {
  const g = GLYPHS.glyphs[char];
  if (!g) throw new Error('glyph not found: ' + char);
  const s = em / UPEM;
  const [xmin, ymin, xmax, ymax] = g.bounds;
  const bxc = (xmin + xmax) / 2;
  const byc = (ymin + ymax) / 2;
  // font は y-up。scale(s,-s) で SVG の y-down に反転しつつ中心を合わせる。
  const t = `translate(${round(cx)} ${round(cy)}) scale(${round(s)} ${round(-s)}) translate(${round(-bxc)} ${round(-byc)})`;
  return `<path d="${g.d}" transform="${t}" fill="${color}"/>`;
}

function round(n) { return Math.round(n * 1000) / 1000; }

// ── 萬子 ───────────────────────────────────────────────────────
const MAN_KANJI = ['一','二','三','四','五','六','七','八','九'];
const MAN_NUM_COLOR = '#1b2431'; // 数字=墨
const MAN_WAN_COLOR = '#b32519'; // 萬=朱
const RED5 = '#d4213a';

function manTile(n, red = false) {
  const numColor = red ? RED5 : MAN_NUM_COLOR;
  const wanColor = red ? RED5 : MAN_WAN_COLOR;
  return tile(`
  ${glyph(MAN_KANJI[n - 1], 17, 17, 20, numColor)}
  ${glyph('萬', 17, 35, 15, wanColor)}
  ${red ? redDot() : ''}`);
}

// ── 数牌の配置（筒子・索子で共通。実牌の標準的な段組み）──────────
//   L=左列(x10.5) C=中央(x17) R=右列(x23.5)。行yは牌の高さ(1.6〜44.8)内で対称配置。
//   7 は「上段3・下段4」、8 は縦2列4段、9 は3×3。実牌の並びに合わせる。
const Y2 = [14, 33];             // 2段
const Y3 = [11, 23.5, 36];       // 3段
const Y4 = [9.5, 19, 28.5, 38]; // 4段
const NUM_POS = {
  1: [[17, 23.5]],
  2: [[17, 13], [17, 34]],
  3: [[11, 12], [17, 23.5], [23.5, 35]],
  4: [[11, 14], [23.5, 14], [11, 33], [23.5, 33]],
  5: [[11, 12.5], [23.5, 12.5], [17, 23.5], [11, 34.5], [23.5, 34.5]],
  6: [[11, 13], [23.5, 13], [11, 23.5], [23.5, 23.5], [11, 34], [23.5, 34]],
  // 7: 上段に3つ(斜め or 横)、下段に4つ … 実牌は「上3・下4」。上段は横3、下段は2×2。
  7: [[10, 11], [17, 11], [24, 11], [11, 27], [23.5, 27], [11, 37.5], [23.5, 37.5]],
  8: [[11, Y4[0]], [23.5, Y4[0]], [11, Y4[1]], [23.5, Y4[1]], [11, Y4[2]], [23.5, Y4[2]], [11, Y4[3]], [23.5, Y4[3]]],
  9: [[10, Y3[0]], [17, Y3[0]], [24, Y3[0]], [10, Y3[1]], [17, Y3[1]], [24, Y3[1]], [10, Y3[2]], [17, Y3[2]], [24, Y3[2]]],
};
// 各数字の玉サイズ（枚数が多いほど小さく）
const PIN_R = { 1: 8, 2: 5.6, 3: 5, 4: 4.8, 5: 4.4, 6: 4.4, 7: 3.9, 8: 4, 9: 3.9 };

// 単独コイン: 外輪(濃) + 中地(象牙) + 内輪(色) + 芯
function coin(cx, cy, r, outer, inner) {
  return `
  <circle cx="${cx}" cy="${cy}" r="${round(r)}" fill="${outer}"/>
  <circle cx="${cx}" cy="${cy}" r="${round(r * 0.66)}" fill="${IVORY}"/>
  <circle cx="${cx}" cy="${cy}" r="${round(r * 0.4)}" fill="${inner}"/>`;
}

function pinTile(n, red = false) {
  const dots = NUM_POS[n];
  const r = PIN_R[n];
  // 実牌に寄せた配色。赤5は全て赤。1筒は大きめの銭形。
  const outer = red ? '#c01f38' : '#15559e';
  const inner = red ? '#8f1228' : '#1f7a4d';
  let body;
  if (n === 1 && !red) {
    // 1筒: 多重リングの銭形
    body = `
  <circle cx="17" cy="23.5" r="9" fill="#15559e"/>
  <circle cx="17" cy="23.5" r="7" fill="${IVORY}"/>
  <circle cx="17" cy="23.5" r="5.4" fill="#c01f38"/>
  <circle cx="17" cy="23.5" r="3.4" fill="${IVORY}"/>
  <circle cx="17" cy="23.5" r="1.7" fill="#15559e"/>`;
  } else {
    body = dots.map(([cx, cy]) => coin(cx, cy, r, outer, inner)).join('\n  ');
  }
  return tile(body + (red ? '\n  ' + redDot() : ''));
}

// ── 索子（節のある竹 / 1索=鳥）─────────────────────────────────
// 縦の稈に上下2つの節（横帯）を持つ竹。h=茎の高さ。
function bamboo(cx, cy, w, h, red = false) {
  const hw = w / 2;
  const body = red ? '#a01840' : '#137a44';
  const dark = red ? '#7f1d1d' : '#0b4a2c';
  const node = red ? '#f0567f' : '#37c07f';
  const lite = red ? '#ffffff66' : '#ffffff55';
  const y0 = cy - h / 2, y1 = cy + h / 2;
  const n1 = cy - h / 6, n2 = cy + h / 6; // 節の位置(上下1/3)
  const nr = hw + 0.7; // 節帯の半幅
  return `
  <rect x="${round(cx - hw)}" y="${round(y0)}" width="${round(w)}" height="${round(h)}" rx="${round(hw)}" fill="${body}" stroke="${dark}" stroke-width="0.4"/>
  <rect x="${round(cx - hw + 0.7)}" y="${round(y0 + 0.8)}" width="1" height="${round(h - 1.6)}" rx="0.5" fill="${lite}"/>
  <rect x="${round(cx - nr)}" y="${round(n1 - 0.9)}" width="${round(nr * 2)}" height="1.8" rx="0.9" fill="${node}"/>
  <rect x="${round(cx - nr)}" y="${round(n2 - 0.9)}" width="${round(nr * 2)}" height="1.8" rx="0.9" fill="${node}"/>`;
}

function sou1Bird(red = false) {
  const b = red ? '#991b1b' : '#12703f';
  const d = red ? '#7f1d1d' : '#0c5030';
  const lt = red ? '#fca5a5' : '#3ecf8e';
  return `
  <ellipse cx="19" cy="27" rx="9" ry="6.4" fill="${b}"/>
  <ellipse cx="11.6" cy="22.4" rx="5.4" ry="5" fill="${b}"/>
  <path d="M10,25 Q14,24 16,28 Q14,30 19,30 Q13,31 10,28Z" fill="${b}"/>
  <polygon points="6,22 10.6,20 10.6,25" fill="#d99a1c"/>
  <circle cx="9" cy="21" r="1.5" fill="#fff"/>
  <circle cx="9.1" cy="21" r="0.8" fill="#111"/>
  <ellipse cx="20" cy="26" rx="6.6" ry="3.6" fill="${d}" opacity="0.55" transform="rotate(-12,20,26)"/>
  <ellipse cx="18" cy="25" rx="3.6" ry="2.2" fill="${lt}" opacity="0.4" transform="rotate(-12,18,25)"/>
  <path d="M27,26 C31,21 33.5,29 29,33 C28,30 27,26 27,26Z" fill="${d}"/>
  <path d="M27,27 C30,24 31,30 28,32 C27.5,30 27,27 27,27Z" fill="${b}"/>
  <line x1="16" y1="33" x2="14" y2="40" stroke="${d}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="11" y2="42" stroke="${d}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="14" y1="40" x2="15" y2="43" stroke="${d}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="20" y1="33" x2="22" y2="40" stroke="${d}" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="19" y2="42" stroke="${d}" stroke-width="1.2" stroke-linecap="round"/>
  <line x1="22" y1="40" x2="24" y2="43" stroke="${d}" stroke-width="1.2" stroke-linecap="round"/>`;
}

// 索子の竹サイズ（幅と高さ）。NUM_POS と同じ段組みで、段数が多いほど短く。
const SOU_DIM = {
  2: { w: 5.6, h: 15 }, 3: { w: 5.4, h: 13 }, 4: { w: 5.4, h: 14 },
  5: { w: 4.8, h: 13 }, 6: { w: 4.8, h: 13 }, 7: { w: 4.4, h: 9.5 },
  8: { w: 4.6, h: 8.5 }, 9: { w: 4.4, h: 9.5 },
};

function souTile(n, red = false) {
  if (n === 1) return tile(sou1Bird(red) + (red ? '\n  ' + redDot() : ''));
  const { w, h } = SOU_DIM[n];
  const dots = NUM_POS[n];
  const stalks = dots.map(([cx, cy]) => bamboo(cx, cy, w, h, red)).join('');
  return tile(stalks + (red ? '\n  ' + redDot() : ''));
}

// ── 字牌 ───────────────────────────────────────────────────────
// 東南西北=黒 / 發=緑 / 中=赤 / 白=青枠（日本の一般的な配色）
const HONORS = [
  { name: 'east',  char: '東', color: '#1b2431' },
  { name: 'south', char: '南', color: '#1b2431' },
  { name: 'west',  char: '西', color: '#1b2431' },
  { name: 'north', char: '北', color: '#1b2431' },
  { name: 'green', char: '發', color: '#1a7d3a' },
  { name: 'red',   char: '中', color: '#c01f2f' },
];

function honorTile({ char, color }) {
  return tile(`\n  ${glyph(char, 17, 23.5, 23, color)}`);
}

// 白: 字ではなく青い二重枠（白板）
function whiteTile() {
  return tile(`
  <rect x="9" y="9" width="16" height="27" rx="2" fill="none" stroke="#2b6cb0" stroke-width="1.4"/>
  <line x1="9.6" y1="9.6" x2="24.4" y2="35.4" stroke="#2b6cb0" stroke-width="0.9"/>`);
}

function redDot() {
  return `<circle cx="6" cy="6.5" r="2.6" fill="${RED5}"/>`;
}

// ── 裏牌 ───────────────────────────────────────────────────────
function backTile() {
  // 裏面: 文字は入れない（表牌と誤認させない）。深緑地に幾何模様。
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect x="2.4" y="3" width="29.6" height="43" rx="4" fill="#0000001f"/>
  <rect x="2" y="1.6" width="30" height="44.4" rx="4" fill="#155e45" stroke="#0e4633" stroke-width="1"/>
  <rect x="3.6" y="3.4" width="26.8" height="40" rx="3" fill="none" stroke="#ffffff2e" stroke-width="0.8"/>
  <line x1="6" y1="6" x2="28" y2="42" stroke="#ffffff14" stroke-width="1.4"/>
  <line x1="28" y1="6" x2="6" y2="42" stroke="#ffffff14" stroke-width="1.4"/>
  <circle cx="17" cy="24" r="6.5" fill="none" stroke="#ffffff2b" stroke-width="1.2"/>
  <circle cx="17" cy="24" r="2.4" fill="#ffffff22"/>
</svg>`.trim();
}

// ── 書き出し ───────────────────────────────────────────────────
const BASE = path.join(__dirname, 'public', 'tiles');
['man', 'pin', 'sou', 'honor'].forEach(d => fs.mkdirSync(path.join(BASE, d), { recursive: true }));

for (let n = 1; n <= 9; n++) {
  fs.writeFileSync(path.join(BASE, 'man', `${n}.svg`), manTile(n));
  fs.writeFileSync(path.join(BASE, 'pin', `${n}.svg`), pinTile(n));
  fs.writeFileSync(path.join(BASE, 'sou', `${n}.svg`), souTile(n));
}
fs.writeFileSync(path.join(BASE, 'man', '5-red.svg'), manTile(5, true));
fs.writeFileSync(path.join(BASE, 'pin', '5-red.svg'), pinTile(5, true));
fs.writeFileSync(path.join(BASE, 'sou', '5-red.svg'), souTile(5, true));

HONORS.forEach(h => fs.writeFileSync(path.join(BASE, 'honor', `${h.name}.svg`), honorTile(h)));
fs.writeFileSync(path.join(BASE, 'honor', 'white.svg'), whiteTile());
fs.writeFileSync(path.join(BASE, 'back.svg'), backTile());

console.log('✓ tiles regenerated (実牌寄り v3 / Noto Serif CJK JP グリフ埋め込み)');
