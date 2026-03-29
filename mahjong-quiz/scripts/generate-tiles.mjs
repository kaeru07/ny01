/**
 * Generates 34 SVG mahjong tile images into public/tiles/
 * Run: node scripts/generate-tiles.mjs
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public', 'tiles')
mkdirSync(OUT_DIR, { recursive: true })

// ----------------------------------------------------------------
// Color palette
// ----------------------------------------------------------------
const COLORS = {
  m: '#B91C1C',       // man: red-700
  p: '#1D4ED8',       // pin: blue-700
  s: '#15803D',       // sou: green-700
  wind: '#374151',    // 東南西北: gray-700
  haku: '#9CA3AF',    // 白: gray-400 (subtle)
  hatsu: '#15803D',   // 發: green-700
  chun: '#B91C1C',    // 中: red-700
}

const SUIT_KANJI = { m: '萬', p: '筒', s: '索' }

const HONOR_MAP = {
  1: { char: '東', color: COLORS.wind },
  2: { char: '南', color: COLORS.wind },
  3: { char: '西', color: COLORS.wind },
  4: { char: '北', color: COLORS.wind },
  5: { char: '白', color: COLORS.haku },
  6: { char: '發', color: COLORS.hatsu },
  7: { char: '中', color: COLORS.chun },
}

// ----------------------------------------------------------------
// SVG builders
// ----------------------------------------------------------------

/** Tile background: cream gradient + border + top-highlight bevel */
function tileBg() {
  return `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="#FDFAF2"/>
      <stop offset="100%" stop-color="#EDE0C4"/>
    </linearGradient>
  </defs>
  <!-- Main tile body -->
  <rect x="1" y="1" width="58" height="78" rx="7" fill="url(#bg)" stroke="#C8A060" stroke-width="1.5"/>
  <!-- Top bevel highlight for subtle 3D -->
  <rect x="4" y="4" width="52" height="34" rx="4" fill="rgba(255,255,255,0.30)"/>`
}

/** Suited tile (man/pin/sou): large number + small suit kanji */
function suitedTile(num, suit) {
  const color = COLORS[suit]
  const kanji = SUIT_KANJI[suit]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
  ${tileBg()}
  <text x="30" y="43" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="35" font-weight="bold" fill="${color}">${num}</text>
  <text x="30" y="67" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="17" fill="${color}">${kanji}</text>
</svg>`
}

/** Honor tile (字牌): single large kanji */
function honorTile(num) {
  const { char, color } = HONOR_MAP[num]
  // 白 gets a lighter stroke for authenticity
  const extraStroke = num === 5
    ? `<rect x="10" y="20" width="40" height="40" rx="3" fill="none" stroke="#D1D5DB" stroke-width="1.5"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80">
  ${tileBg()}
  ${extraStroke}
  <text x="30" y="40" text-anchor="middle" dominant-baseline="middle"
        font-family="'Hiragino Mincho ProN','Yu Mincho',Georgia,serif"
        font-size="31" font-weight="bold" fill="${color}">${char}</text>
</svg>`
}

// ----------------------------------------------------------------
// Generate files
// ----------------------------------------------------------------

let count = 0

// Man / Pin / Sou
for (const suit of ['m', 'p', 's']) {
  for (let n = 1; n <= 9; n++) {
    writeFileSync(join(OUT_DIR, `${n}${suit}.svg`), suitedTile(n, suit))
    count++
  }
}

// Honor tiles 1z–7z
for (let n = 1; n <= 7; n++) {
  writeFileSync(join(OUT_DIR, `${n}z.svg`), honorTile(n))
  count++
}

console.log(`✅ Generated ${count} tile SVGs → ${OUT_DIR}`)
