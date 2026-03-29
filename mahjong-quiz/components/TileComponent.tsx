'use client'

import { useState } from 'react'
import {
  getTileSuit,
  getTileValue,
  JIHAI_LABELS,
  SUIT_KANJI,
  getTileColorClass,
  getTileLabel,
} from '@/lib/mahjong-utils'
import { TileStr } from '@/lib/types'

export type TileSize = 'xs' | 'sm' | 'md' | 'lg'
export type TileVariant = 'default' | 'selected' | 'hit' | 'miss' | 'missed' | 'dora' | 'tried'

const SIZE_CLASSES: Record<TileSize, { outer: string; main: string; sub: string }> = {
  xs: { outer: 'w-5 h-[26px]',  main: 'text-[9px]',  sub: 'text-[7px]'  },
  sm: { outer: 'w-[22px] h-8',  main: 'text-[10px]', sub: 'text-[8px]'  },
  md: { outer: 'w-[26px] h-9',  main: 'text-xs',     sub: 'text-[9px]'  },
  lg: { outer: 'w-8 h-11',      main: 'text-sm',     sub: 'text-[10px]' },
}

// Wrapper dimensions when tile is rotated 90° (w/h swapped)
const ROTATED_OUTER: Record<TileSize, string> = {
  xs: 'w-[26px] h-5',
  sm: 'w-8 h-[22px]',
  md: 'w-9 h-[26px]',
  lg: 'w-11 h-8',
}

// Ring highlight per variant (image mode)
const VARIANT_RING: Record<TileVariant, string> = {
  default:  '',
  selected: 'ring-2 ring-blue-500',
  hit:      'ring-2 ring-green-500',
  miss:     'ring-2 ring-red-400',
  missed:   'ring-2 ring-amber-400',
  dora:     'ring-2 ring-yellow-400',
  tried:    '',
}

// Background + border classes for text fallback mode
const VARIANT_TEXT_CLASSES: Record<TileVariant, string> = {
  default:  'bg-white border-gray-300 shadow-sm',
  selected: 'bg-blue-50 border-blue-500 border-2 shadow',
  hit:      'bg-green-50 border-green-500 border-2',
  miss:     'bg-red-50 border-red-400 border-2',
  missed:   'bg-amber-50 border-amber-400 border-2',
  dora:     'bg-yellow-50 border-yellow-400 border-2',
  tried:    'bg-gray-50 border-gray-300 opacity-50',
}

interface TileComponentProps {
  tile: TileStr
  size?: TileSize
  variant?: TileVariant
  onClick?: () => void
  disabled?: boolean
  className?: string
  rotated?: boolean
}

export default function TileComponent({
  tile,
  size = 'md',
  variant = 'default',
  onClick,
  disabled = false,
  className = '',
  rotated = false,
}: TileComponentProps) {
  const [imgError, setImgError] = useState(false)

  const { outer, main, sub } = SIZE_CLASSES[size]
  const Tag = onClick ? 'button' : 'div'
  const clickProps = onClick ? { onClick: disabled ? undefined : onClick, disabled, type: 'button' as const } : {}
  const interactiveClass = onClick && !disabled ? 'cursor-pointer active:scale-95 transition-transform' : ''
  const disabledClass = disabled ? 'opacity-40 cursor-not-allowed' : ''

  // ── Image-based rendering ────────────────────────────────────────
  if (!imgError) {
    const ringClass = VARIANT_RING[variant]
    const dimClass  = variant === 'tried' ? 'opacity-40' : ''

    const imgTile = (
      <Tag
        {...clickProps}
        className={[
          outer,
          'rounded-sm overflow-hidden shrink-0 select-none',
          ringClass,
          dimClass,
          interactiveClass,
          disabledClass,
          className,
          rotated ? 'rotate-90' : '',
        ].filter(Boolean).join(' ')}
      >
        <img
          src={`/tiles/${tile}.svg`}
          alt={getTileLabel(tile)}
          width={60}
          height={80}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </Tag>
    )

    if (rotated) {
      return (
        <div className={`${ROTATED_OUTER[size]} flex items-center justify-center shrink-0`}>
          {imgTile}
        </div>
      )
    }

    return imgTile
  }

  // ── Text fallback (original rendering) ──────────────────────────
  const suit = getTileSuit(tile)
  const isJihai = suit === 'z'
  const colorClass = getTileColorClass(tile)
  const variantClass = VARIANT_TEXT_CLASSES[variant]

  const textTile = (
    <Tag
      {...clickProps}
      className={[
        outer,
        variantClass,
        'border rounded flex flex-col items-center justify-center leading-none select-none shrink-0',
        interactiveClass,
        disabledClass,
        rotated ? 'rotate-90' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {isJihai ? (
        <span className={`${colorClass} ${main} font-bold`}>
          {JIHAI_LABELS[tile] ?? tile}
        </span>
      ) : (
        <>
          <span className={`${colorClass} ${main} font-bold`}>
            {getTileValue(tile)}
          </span>
          <span className={`${colorClass} ${sub} opacity-80`}>
            {SUIT_KANJI[suit]}
          </span>
        </>
      )}
    </Tag>
  )

  if (rotated) {
    return (
      <div className={`${ROTATED_OUTER[size]} flex items-center justify-center shrink-0`}>
        {textTile}
      </div>
    )
  }

  return textTile
}
