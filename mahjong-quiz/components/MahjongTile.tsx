'use client'

/**
 * MahjongTile — lightweight image-based tile renderer
 *
 * Accepts both internal format ("1m", "7z") and human-readable aliases
 * ("east", "haku", "chun", etc.).  Falls back to a text badge if the SVG
 * fails to load.
 *
 * Props
 *   tile   — tile identifier (see ALIASES for honour names)
 *   size   — pixel width of the rendered tile (default 28)
 *   dim    — lower opacity (for tsumokiri / unimportant tiles)
 *   rotated — rotate 90° (for riichi declaration tile)
 */

import { useState } from 'react'

// Maps human-readable honour names → internal TileStr
const ALIASES: Record<string, string> = {
  east:  '1z',
  south: '2z',
  west:  '3z',
  north: '4z',
  haku:  '5z',
  hatsu: '6z',
  chun:  '7z',
}

// Text fallback labels
const FALLBACK_LABEL: Record<string, string> = {
  '1m':'1萬','2m':'2萬','3m':'3萬','4m':'4萬','5m':'5萬',
  '6m':'6萬','7m':'7萬','8m':'8萬','9m':'9萬',
  '1p':'1筒','2p':'2筒','3p':'3筒','4p':'4筒','5p':'5筒',
  '6p':'6筒','7p':'7筒','8p':'8筒','9p':'9筒',
  '1s':'1索','2s':'2索','3s':'3索','4s':'4索','5s':'5索',
  '6s':'6索','7s':'7索','8s':'8索','9s':'9索',
  '1z':'東','2z':'南','3z':'西','4z':'北',
  '5z':'白','6z':'發','7z':'中',
}

interface MahjongTileProps {
  tile: string
  size?: number
  dim?: boolean
  rotated?: boolean
  onClick?: () => void
}

export default function MahjongTile({
  tile,
  size = 28,
  dim = false,
  rotated = false,
  onClick,
}: MahjongTileProps) {
  const [err, setErr] = useState(false)

  // Resolve alias → internal name
  const id = ALIASES[tile] ?? tile
  const label = FALLBACK_LABEL[id] ?? id

  // Aspect ratio matches SVG viewBox (60:80 = 3:4)
  const w = size
  const h = Math.round(size * (80 / 60))

  const opacity = dim ? 0.5 : 1

  // Wrapper handles rotation by swapping w/h in the reserved space
  const wrapStyle: React.CSSProperties = rotated
    ? { width: h, height: w, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
    : { display: 'inline-block', flexShrink: 0 }

  const imgStyle: React.CSSProperties = {
    width: w,
    height: h,
    opacity,
    transform: rotated ? 'rotate(90deg)' : undefined,
    display: 'block',
    userSelect: 'none',
    cursor: onClick ? 'pointer' : undefined,
  }

  if (!err) {
    return (
      <span style={wrapStyle}>
        <img
          src={`/tiles/${id}.svg`}
          alt={label}
          width={w}
          height={h}
          loading="lazy"
          draggable={false}
          onError={() => setErr(true)}
          onClick={onClick}
          style={imgStyle}
          className="tile-img"
        />
      </span>
    )
  }

  // ── Text fallback ────────────────────────────────────────────────
  const textStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: w,
    height: h,
    fontSize: Math.max(8, Math.round(size * 0.45)),
    fontWeight: 'bold',
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 4,
    opacity,
    cursor: onClick ? 'pointer' : undefined,
    userSelect: 'none',
    flexShrink: 0,
    transform: rotated ? 'rotate(90deg)' : undefined,
  }

  return (
    <span style={wrapStyle}>
      <span style={textStyle} onClick={onClick}>{label}</span>
    </span>
  )
}
