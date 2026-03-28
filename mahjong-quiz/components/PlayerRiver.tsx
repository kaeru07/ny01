import TileComponent from './TileComponent'
import { Discard, Meld, MeldType } from '@/lib/types'
import { getMeldTypeLabel } from '@/lib/mahjong-utils'

const MELD_LABEL_CLASS: Record<MeldType, string> = {
  chi:   'text-blue-600',
  pon:   'text-orange-600',
  kan:   'text-purple-600',
  ankan: 'text-gray-600',
}

const MELD_BORDER_CLASS: Record<MeldType, string> = {
  chi:   'border-blue-200 bg-blue-50',
  pon:   'border-orange-200 bg-orange-50',
  kan:   'border-purple-200 bg-purple-50',
  ankan: 'border-gray-200 bg-gray-50',
}

interface PlayerRiverProps {
  seat: string
  discards: Discard[]
  melds: Meld[]
  riichiState: boolean
  riichiTurn?: number
  isSubject?: boolean
}

export default function PlayerRiver({
  seat,
  discards,
  melds,
  riichiState,
  riichiTurn,
  isSubject = false,
}: PlayerRiverProps) {
  const riichiDeclIndex = riichiState
    ? (() => {
        const firstTsumokiri = discards.findIndex((d) => d.tsumokiri)
        return firstTsumokiri > 0 ? firstTsumokiri - 1 : discards.length - 1
      })()
    : -1

  return (
    <div
      className={`rounded-lg p-2.5 border ${
        isSubject
          ? 'border-indigo-300 bg-indigo-50/40 ring-1 ring-indigo-200'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* Header: seat label + riichi badge */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`text-xs font-bold ${
            isSubject ? 'text-indigo-800' : 'text-gray-600'
          }`}
        >
          {seat}
        </span>
        {isSubject && (
          <span className="text-[10px] text-indigo-500 font-semibold border border-indigo-200 bg-indigo-100 px-1 py-px rounded">
            読みの対象
          </span>
        )}
        {riichiState && (
          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1 py-0.5 rounded border border-red-300">
            リーチ{riichiTurn != null ? `（${riichiTurn}巡目）` : ''}
          </span>
        )}
      </div>

      {/* Discards */}
      {discards.length > 0 ? (
        <div className="space-y-0.5">
          {Array.from({ length: Math.ceil(discards.length / 6) }, (_, row) => (
            <div key={row} className="flex gap-px">
              {discards.slice(row * 6, row * 6 + 6).map((d, col) => {
                const i = row * 6 + col
                const isRiichiDecl = i === riichiDeclIndex
                return (
                  <TileComponent
                    key={i}
                    tile={d.tile}
                    size="xs"
                    className={[
                      d.tsumokiri ? 'opacity-40' : '',
                      isRiichiDecl ? 'ring-2 ring-red-400 rounded' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  />
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">捨て牌なし</p>
      )}

      {/* Melds */}
      {melds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {melds.map((meld, mi) => (
            <div
              key={mi}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md border ${MELD_BORDER_CLASS[meld.type]}`}
            >
              <div className="flex gap-0.5">
                {meld.tiles.map((tile, ti) => (
                  <TileComponent key={ti} tile={tile} size="xs" />
                ))}
              </div>
              <span className={`text-[9px] font-bold ${MELD_LABEL_CLASS[meld.type]}`}>
                {getMeldTypeLabel(meld.type)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
