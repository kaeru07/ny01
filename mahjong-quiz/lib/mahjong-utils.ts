import { TileSuit, TileStr } from './types'

export const ALL_TILES: TileStr[] = [
  '1m', '2m', '3m', '4m', '5m', '6m', '7m', '8m', '9m',
  '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p',
  '1s', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s',
  '1z', '2z', '3z', '4z', '5z', '6z', '7z',
]

export const JIHAI_LABELS: Record<string, string> = {
  '1z': '東', '2z': '南', '3z': '西', '4z': '北',
  '5z': '白', '6z': '發', '7z': '中',
}

export const SUIT_KANJI: Record<string, string> = {
  m: '萬', p: '筒', s: '索',
}

export const SUIT_LABEL: Record<string, string> = {
  m: '萬子', p: '筒子', s: '索子', z: '字牌',
}

export function getTileSuit(tile: TileStr): TileSuit {
  return tile[1] as TileSuit
}

export function getTileValue(tile: TileStr): number {
  return parseInt(tile[0])
}

export function getTileLabel(tile: TileStr): string {
  const suit = getTileSuit(tile)
  if (suit === 'z') return JIHAI_LABELS[tile] ?? tile
  return `${getTileValue(tile)}${SUIT_KANJI[suit]}`
}

/** The actual dora tile (one step above the indicator) */
export function getDoraTile(indicator: TileStr): TileStr {
  const suit = getTileSuit(indicator)
  const value = getTileValue(indicator)
  if (suit === 'z') {
    if (value <= 4) return `${(value % 4) + 1}z` // winds cycle 1→2→3→4→1
    return `${((value - 5) % 3) + 5}z`            // dragons cycle 5→6→7→5
  }
  return `${(value % 9) + 1}${suit}`
}

const SUIT_ORDER: Record<string, number> = { m: 0, p: 1, s: 2, z: 3 }

export function sortTiles(tiles: TileStr[]): TileStr[] {
  return [...tiles].sort((a, b) => {
    const sa = SUIT_ORDER[getTileSuit(a)]
    const sb = SUIT_ORDER[getTileSuit(b)]
    if (sa !== sb) return sa - sb
    return getTileValue(a) - getTileValue(b)
  })
}

export function getTileColorClass(tile: TileStr): string {
  const suit = getTileSuit(tile)
  if (suit === 'm') return 'text-red-600'
  if (suit === 'p') return 'text-sky-600'
  if (suit === 's') return 'text-emerald-600'
  const val = getTileValue(tile)
  if (val === 6) return 'text-emerald-700' // 發
  if (val === 7) return 'text-red-700'     // 中
  return 'text-slate-700'                  // 東南西北白
}

export function getDifficultyLabel(d: string): string {
  return { beginner: '初級', intermediate: '中級', advanced: '上級' }[d] ?? d
}

export function getDifficultyBadgeClass(d: string): string {
  return (
    {
      beginner: 'bg-green-100 text-green-800 border-green-300',
      intermediate: 'bg-amber-100 text-amber-800 border-amber-300',
      advanced: 'bg-red-100 text-red-800 border-red-300',
    }[d] ?? 'bg-gray-100 text-gray-700 border-gray-300'
  )
}

export function getMeldTypeLabel(t: string): string {
  return { chi: 'チー', pon: 'ポン', kan: 'カン', ankan: '暗カン' }[t] ?? t
}

export function getCategoryLabel(c: string): string {
  return { basic: '基礎問題', kifu: '牌譜問題' }[c] ?? c
}

export function getCategoryBadgeClass(c: string): string {
  return (
    {
      basic:  'bg-indigo-50 text-indigo-700 border-indigo-200',
      kifu:   'bg-teal-50 text-teal-700 border-teal-200',
    }[c] ?? 'bg-gray-100 text-gray-600 border-gray-200'
  )
}

export function getSourceTypeBadge(
  s: string,
): { label: string; className: string } {
  const map: Record<string, { label: string; className: string }> = {
    tenhou:      { label: '天鳳', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    mahjongsoul: { label: '雀魂', className: 'bg-purple-100 text-purple-700 border-purple-200' },
    manual:      { label: '教材', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  }
  return map[s] ?? { label: s, className: 'bg-gray-100 text-gray-600 border-gray-200' }
}
