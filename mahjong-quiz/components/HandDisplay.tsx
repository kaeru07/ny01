import TileComponent from './TileComponent'
import { TileStr } from '@/lib/types'
import { Meld, MeldType } from '@/lib/types'
import { getMeldTypeLabel } from '@/lib/mahjong-utils'

interface HandDisplayProps {
  hand: TileStr[]
  melds?: Meld[]
  riichiState?: boolean
}

const MELD_LABEL_CLASS: Record<MeldType, string> = {
  chi:   'text-blue-600',
  pon:   'text-orange-600',
  kan:   'text-purple-600',
  ankan: 'text-gray-600',
}

export default function HandDisplay({ hand, melds = [], riichiState = false }: HandDisplayProps) {
  return (
    <div className="space-y-1">
      {/* Closed hand */}
      <div className="flex items-center gap-1">
        <div className="overflow-x-auto">
          <div className="flex gap-[2px] pb-0.5">
            {hand.map((tile, i) => (
              <TileComponent key={`${tile}-${i}`} tile={tile} size="sm" />
            ))}
          </div>
        </div>
        {riichiState && (
          <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-700 border border-red-300 rounded shrink-0">
            リーチ
          </span>
        )}
      </div>

      {/* Open melds */}
      {melds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {melds.map((meld, mi) => (
            <div key={mi} className="flex flex-col items-center gap-px">
              <div className="flex gap-[1px]">
                {meld.tiles.map((tile, ti) => (
                  <TileComponent key={ti} tile={tile} size="xs" />
                ))}
              </div>
              <span className={`text-[9px] font-semibold ${MELD_LABEL_CLASS[meld.type]}`}>
                {getMeldTypeLabel(meld.type)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
