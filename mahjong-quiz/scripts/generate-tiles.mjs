/**
 * Tenhou-style mahjong tile SVG generator
 * Run: node scripts/generate-tiles.mjs
 * Output: public/tiles/{1-9}{m,p,s}.svg  public/tiles/{1-7}z.svg  (34 files)
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dir, '..', 'public', 'tiles')
mkdirSync(OUT, { recursive: true })

// ─── Tile shell ──────────────────────────────────────────────────────────────
// viewBox 0 0 60 80  (aspect ratio 3:4, identical to existing SIZE_CLASSES)
function shell(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#FEFCF3"/>
      <stop offset="100%" stop-color="#EDE3C5"/>
    </linearGradient>
  </defs>
  <!-- Tile body -->
  <rect x="1" y="1" width="58" height="78" rx="6" fill="url(#bg)" stroke="#C9A84C" stroke-width="1.5"/>
  <!-- Top bevel -->
  <rect x="4" y="4" width="52" height="30" rx="4" fill="rgba(255,255,255,0.26)"/>
  ${inner}
</svg>`
}

// ─── Man 萬子 ────────────────────────────────────────────────────────────────
// Design: Arabic numeral (large, red) + 萬 below + thin gold rules
for (let n = 1; n <= 9; n++) {
  const inner = `
  <line x1="9" y1="12" x2="51" y2="12" stroke="#C9A84C" stroke-width="0.7"/>
  <text x="30" y="45" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="36" font-weight="bold" fill="#B91C1C">${n}</text>
  <text x="30" y="68" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="17" fill="#B91C1C">萬</text>
  <line x1="9" y1="74" x2="51" y2="74" stroke="#C9A84C" stroke-width="0.7"/>`
  writeFileSync(join(OUT, `${n}m.svg`), shell(inner))
}
console.log('✓ Man (9)')

// ─── Pin 筒子 ────────────────────────────────────────────────────────────────
// Design: Blue concentric-ring circles in traditional arrangements
// Each circle: dark-blue ring → light-blue fill → dark-blue centre dot
function pCircle(cx, cy, r) {
  const ri = +(r * 0.58).toFixed(1)
  const rd = +(r * 0.24).toFixed(1)
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}"  fill="#1E40AF"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${ri}" fill="#DBEAFE"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${rd}" fill="#1E40AF"/>`
  )
}

// [cx, cy, r] for each tile
const PIN = {
  1: [[30, 40, 15]],
  2: [[30, 24, 12], [30, 56, 12]],
  3: [[18, 23, 12], [42, 23, 12], [30, 58, 12]],
  4: [[19, 24, 11], [41, 24, 11], [19, 56, 11], [41, 56, 11]],
  5: [[19, 21, 10], [41, 21, 10], [30, 40, 10], [19, 59, 10], [41, 59, 10]],
  6: [[19, 18, 10], [41, 18, 10], [19, 40, 10], [41, 40, 10], [19, 62, 10], [41, 62, 10]],
  7: [[13, 17,  9], [30, 17,  9], [47, 17,  9],
      [30, 38,  9],
      [13, 62,  9], [30, 62,  9], [47, 62,  9]],
  8: [[19, 14,  9], [41, 14,  9],
      [19, 32,  9], [41, 32,  9],
      [19, 49,  9], [41, 49,  9],
      [19, 66,  9], [41, 66,  9]],
  9: [[13, 17,  8], [30, 17,  8], [47, 17,  8],
      [13, 38,  8], [30, 38,  8], [47, 38,  8],
      [13, 59,  8], [30, 59,  8], [47, 59,  8]],
}

for (let n = 1; n <= 9; n++) {
  const inner = PIN[n].map(([cx, cy, r]) => pCircle(cx, cy, r)).join('\n  ')
  writeFileSync(join(OUT, `${n}p.svg`), shell(inner))
}
console.log('✓ Pin (9)')

// ─── Sou 索子 ────────────────────────────────────────────────────────────────
// Design: green bamboo rods with node rings, arranged in traditional patterns
// Each rod: rounded rect + horizontal node band + left-side highlight
function rod(cx, y, h, w = 10) {
  const x = cx - w / 2
  const ny = +(y + h * 0.45).toFixed(0)
  return [
    `<rect x="${x}"   y="${y}"  width="${w}"   height="${h}" rx="${w / 2}" fill="#15803D"/>`,
    // node band
    `<rect x="${x-1}" y="${ny}" width="${w+2}" height="3"    rx="1.5"     fill="#166534"/>`,
    // left highlight
    `<rect x="${x+2}" y="${y+3}" width="${+(w * 0.3).toFixed(0)}" height="${+(h * 0.38).toFixed(0)}" rx="2" fill="rgba(255,255,255,0.22)"/>`,
  ].join('\n  ')
}

// [cx, y, h] arrays per tile; w=10 (default)
const SOD = {
  // 1s: special – single tall bamboo with side leaves
  1: null,
  2: [[30, 10, 27], [30, 46, 27]],
  3: [[30,  8, 20], [30, 33, 20], [30, 58, 20]],
  4: [[20, 12, 26], [40, 12, 26], [20, 46, 26], [40, 46, 26]],
  5: [[20, 12, 23], [40, 12, 23], [30, 31, 20], [20, 52, 23], [40, 52, 23]],
  6: [[20,  9, 20], [40,  9, 20], [20, 33, 20], [40, 33, 20], [20, 57, 20], [40, 57, 20]],
  7: [[13, 10, 18], [30, 10, 18], [47, 10, 18],
      [30, 34, 18],
      [13, 56, 18], [30, 56, 18], [47, 56, 18]],
  8: [[20,  8, 16], [40,  8, 16],
      [20, 28, 16], [40, 28, 16],
      [20, 48, 16], [40, 48, 16],
      [20, 68, 10], [40, 68, 10]],
  9: [[13,  9, 18], [30,  9, 18], [47,  9, 18],
      [13, 32, 18], [30, 32, 18], [47, 32, 18],
      [13, 55, 18], [30, 55, 18], [47, 55, 18]],
}

// 1s: tall single bamboo with stylised leaf tufts
function oneSou() {
  return shell(`
  <!-- Main stalk -->
  <rect x="26" y="8"  width="8" height="64" rx="4" fill="#15803D"/>
  <!-- Node bands -->
  <rect x="24" y="25" width="12" height="3" rx="1.5" fill="#166534"/>
  <rect x="24" y="46" width="12" height="3" rx="1.5" fill="#166534"/>
  <!-- Highlight -->
  <rect x="28" y="11" width="3" height="22" rx="1.5" fill="rgba(255,255,255,0.22)"/>
  <!-- Left leaves -->
  <ellipse cx="18" cy="20" rx="9" ry="5" fill="#16a34a" transform="rotate(-40 18 20)"/>
  <ellipse cx="16" cy="42" rx="9" ry="5" fill="#16a34a" transform="rotate(-50 16 42)"/>
  <!-- Right leaves -->
  <ellipse cx="42" cy="30" rx="9" ry="5" fill="#16a34a" transform="rotate(40 42 30)"/>
  <ellipse cx="44" cy="55" rx="9" ry="5" fill="#16a34a" transform="rotate(50 44 55)"/>`)
}

for (let n = 1; n <= 9; n++) {
  if (n === 1) {
    writeFileSync(join(OUT, '1s.svg'), oneSou())
  } else {
    const inner = SOD[n].map(([cx, y, h]) => rod(cx, y, h)).join('\n  ')
    writeFileSync(join(OUT, `${n}s.svg`), shell(inner))
  }
}
console.log('✓ Sou (9)')

// ─── Honors 字牌 ─────────────────────────────────────────────────────────────
const JIHAI = [
  { char: '東', color: '#1E3A5F' }, // 1z dark navy
  { char: '南', color: '#1E3A5F' }, // 2z
  { char: '西', color: '#1E3A5F' }, // 3z
  { char: '北', color: '#1E3A5F' }, // 4z
  { char: '白', color: '#9CA3AF' }, // 5z gray
  { char: '發', color: '#15803D' }, // 6z green
  { char: '中', color: '#B91C1C' }, // 7z red
]

for (let n = 1; n <= 7; n++) {
  const { char, color } = JIHAI[n - 1]

  // 白 gets a decorative hollow rectangle (like the real tile)
  const extra = n === 5
    ? `<rect x="9" y="16" width="42" height="50" rx="4"
           fill="none" stroke="#9CA3AF" stroke-width="1.5"/>`
    : ''

  const inner = `
  ${extra}
  <text x="30" y="41" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="32" font-weight="bold" fill="${color}">${char}</text>`

  writeFileSync(join(OUT, `${n}z.svg`), shell(inner))
}
console.log('✓ Honors (7)')
console.log(`\n✅ All 34 tiles → ${OUT}`)
