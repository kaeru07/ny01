import TileComponent from './TileComponent'
import PlayerRiver from './PlayerRiver'
import { Discard, Meld, TileStr, PlayerVisibleInfo } from '@/lib/types'
import { getDoraTile } from '@/lib/mahjong-utils'

interface BoardInfoProps {
  turn: number
  doraIndicators: TileStr[]
  riichiState: boolean
  riichiTurn?: number
  discards: Discard[]
  melds: Meld[]
  seatWind?: string
  players?: PlayerVisibleInfo[]
}

export default function BoardInfo({
  turn,
  doraIndicators,
  riichiState,
  riichiTurn,
  discards,
  melds,
  seatWind,
  players,
}: BoardInfoProps) {
  const subjectLabel = seatWind ? `和了者（${seatWind}家）` : '和了者'

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
              →{' '}
              <span className="font-bold text-amber-700">
                ドラ: {doraIndicators.map((t) => getDoraTile(t)).join('・')}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Discard legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-5 bg-white border border-gray-300 rounded text-center leading-5 text-[9px] shadow-sm">
            牌
          </span>
          手出し
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-5 bg-white border border-gray-200 rounded text-center leading-5 text-[9px] opacity-40 shadow-sm">
            牌
          </span>
          ツモ切り
        </span>
        {riichiState && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-4 h-5 bg-red-50 border-2 border-red-400 rounded text-center leading-5 text-[9px] shadow-sm">
              牌
            </span>
            リーチ宣言
          </span>
        )}
      </div>

      {/* Quiz subject's river — always shown, highlighted */}
      <PlayerRiver
        seat={subjectLabel}
        discards={discards}
        melds={melds}
        riichiState={riichiState}
        riichiTurn={riichiTurn}
        isSubject={true}
      />

      {/* Other players' rivers */}
      {players && players.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-500">他家の河</span>
          <div className="space-y-1.5">
            {players.map((player) => (
              <PlayerRiver
                key={player.seat}
                seat={player.seat}
                discards={player.discards}
                melds={player.melds}
                riichiState={player.riichiState}
                riichiTurn={player.riichiTurn}
                isSubject={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
