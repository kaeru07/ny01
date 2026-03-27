import TileComponent from './TileComponent'
import { Discard, Meld, MeldType, TileStr } from '@/lib/types'
import { getDoraTile, getMeldTypeLabel } from '@/lib/mahjong-utils'

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

interface BoardInfoProps {
  turn: number
  doraIndicators: TileStr[]
  riichiState: boolean
  riichiTurn?: number
  discards: Discard[]
  melds: Meld[]
}

export default function BoardInfo({
  turn,
  doraIndicators,
  riichiState,
  riichiTurn,
  discards,
  melds,
}: BoardInfoProps) {
  // Find the index of the riichi declaration tile (last hand-discard before tsumokiri series starts)
  const riichiDeclIndex = riichiState
    ? (() => {
        const firstTsumokiri = discards.findIndex((d) => d.tsumokiri)
        return firstTsumokiri > 0 ? firstTsumokiri - 1 : discards.length - 1
      })()
    : -1

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3 border border-gray-200">
      {/* Turn / Riichi / Dora row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 items-center">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">巡目</span>
          <span className="text-sm font-bold text-gray-800">{turn}巡目</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-gray-500 font-medium">リーチ</span>
          {riichiState ? (
            <span className="text-[11px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
              ✓ 宣言済み{riichiTurn != null ? `（${riichiTurn}巡目）` : ''}
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">なし</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-500 font-medium">ドラ表示牌</span>
          <div className="flex gap-1 items-center">
            {doraIndicators.map((t, i) => (
              <TileComponent key={i} tile={t} size="xs" variant="dora" />
            ))}
            <span className="text-[11px] text-gray-500 ml-0.5">
              → <span className="font-bold text-amber-700">
                ドラ: {doraIndicators.map((t) => getDoraTile(t)).join('・')}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Discards / River */}
      {discards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-gray-600">捨て牌</span>
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-5 bg-white border border-gray-300 rounded text-center leading-5 text-[9px] shadow-sm">牌</span>
                手出し
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-5 bg-white border border-gray-200 rounded text-center leading-5 text-[9px] opacity-40 shadow-sm">牌</span>
                ツモ切り
              </span>
              {riichiState && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-5 bg-red-50 border-2 border-red-400 rounded text-center leading-5 text-[9px] shadow-sm">牌</span>
                  リーチ宣言
                </span>
              )}
            </div>
          </div>

          {/* Discard tiles in rows of 6, mirroring real mahjong layout */}
          <div className="space-y-1">
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
                      ].filter(Boolean).join(' ')}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open melds */}
      {melds.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold text-gray-600 block mb-1.5">副露</span>
          <div className="flex flex-wrap gap-2">
            {melds.map((meld, mi) => (
              <div
                key={mi}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border ${MELD_BORDER_CLASS[meld.type]}`}
              >
                <div className="flex gap-0.5">
                  {meld.tiles.map((tile, ti) => (
                    <TileComponent key={ti} tile={tile} size="xs" />
                  ))}
                </div>
                <span className={`text-[10px] font-bold ${MELD_LABEL_CLASS[meld.type]}`}>
                  {getMeldTypeLabel(meld.type)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
