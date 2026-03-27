import TileComponent from './TileComponent'
import { TileStr } from '@/lib/types'
import { getDoraTile } from '@/lib/mahjong-utils'

interface BoardInfoProps {
  turn: number
  doraIndicators: TileStr[]
  riichiState: boolean
  discards: TileStr[]
}

export default function BoardInfo({
  turn,
  doraIndicators,
  riichiState,
  discards,
}: BoardInfoProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2.5 border border-gray-200">
      {/* Turn / Riichi / Dora row */}
      <div className="flex flex-wrap gap-4 items-start">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">巡目</span>
          <span className="text-sm font-bold text-gray-800">{turn}巡目</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">リーチ</span>
          {riichiState ? (
            <span className="text-xs font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
              宣言済み
            </span>
          ) : (
            <span className="text-xs text-gray-400">なし</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">ドラ表示牌</span>
          <div className="flex gap-1">
            {doraIndicators.map((t, i) => (
              <TileComponent key={i} tile={t} size="xs" variant="dora" />
            ))}
          </div>
          <span className="text-xs text-gray-400">
            →ドラ:&nbsp;
            {doraIndicators.map((t) => getDoraTile(t)).join('・')}
          </span>
        </div>
      </div>

      {/* Discards / River */}
      {discards.length > 0 && (
        <div>
          <span className="text-xs text-gray-500 font-medium block mb-1">河（自分の捨て牌）</span>
          <div className="flex flex-wrap gap-1">
            {discards.map((tile, i) => (
              <TileComponent key={i} tile={tile} size="xs" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
