import {
  getTileSuit,
  getTileValue,
  JIHAI_LABELS,
  SUIT_KANJI,
  getTileColorClass,
} from '@/lib/mahjong-utils'
import { TileStr } from '@/lib/types'

export type TileSize = 'xs' | 'sm' | 'md' | 'lg'
export type TileVariant = 'default' | 'selected' | 'hit' | 'miss' | 'missed' | 'dora'

const SIZE_CLASSES: Record<TileSize, { outer: string; main: string; sub: string }> = {
  xs: { outer: 'w-7 h-9',  main: 'text-xs',  sub: 'text-[9px]'  },
  sm: { outer: 'w-8 h-11', main: 'text-sm',  sub: 'text-[10px]' },
  md: { outer: 'w-9 h-12', main: 'text-sm',  sub: 'text-xs'     },
  lg: { outer: 'w-11 h-14',main: 'text-base',sub: 'text-xs'     },
}

const VARIANT_CLASSES: Record<TileVariant, string> = {
  default:  'bg-white border-gray-300 shadow-sm',
  selected: 'bg-blue-50 border-blue-500 border-2 shadow',
  hit:      'bg-green-50 border-green-500 border-2',
  miss:     'bg-red-50 border-red-400 border-2',
  missed:   'bg-amber-50 border-amber-400 border-2',
  dora:     'bg-yellow-50 border-yellow-400 border-2',
}

interface TileComponentProps {
  tile: TileStr
  size?: TileSize
  variant?: TileVariant
  onClick?: () => void
  disabled?: boolean
  className?: string
}

export default function TileComponent({
  tile,
  size = 'md',
  variant = 'default',
  onClick,
  disabled = false,
  className = '',
}: TileComponentProps) {
  const suit = getTileSuit(tile)
  const isJihai = suit === 'z'
  const colorClass = getTileColorClass(tile)
  const { outer, main, sub } = SIZE_CLASSES[size]
  const variantClass = VARIANT_CLASSES[variant]

  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      {...(onClick ? { onClick, disabled, type: 'button' as const } : {})}
      className={`
        ${outer}
        ${variantClass}
        border rounded flex flex-col items-center justify-center leading-none select-none
        ${onClick && !disabled ? 'cursor-pointer hover:brightness-95 active:scale-95 transition-transform' : ''}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${className}
      `}
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
}
