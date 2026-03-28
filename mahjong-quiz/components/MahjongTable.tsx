import { Discard, Meld, TileStr, PlayerVisibleInfo } from '@/lib/types'
import { getDoraTile, getMeldTypeLabel, getTileLabel } from '@/lib/mahjong-utils'
import TileComponent from './TileComponent'

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function getRiichiDeclIdx(discards: Discard[], riichiState: boolean): number {
  if (!riichiState) return -1
  const idx = discards.findIndex((d) => d.tsumokiri)
  return idx > 0 ? idx - 1 : discards.length - 1
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function RiichiBadge({ riichiTurn }: { riichiTurn?: number }) {
  return (
    <span className="inline-flex items-center text-[9px] font-bold text-red-200 bg-red-700/80 border border-red-500/60 px-1 py-px rounded leading-none">
      リーチ{riichiTurn != null ? ` ${riichiTurn}巡` : ''}
    </span>
  )
}

/** Tile grid — rows of `tilesPerRow` */
function DiscardGrid({
  discards,
  riichiState,
  tilesPerRow = 6,
  dim = false,
}: {
  discards: Discard[]
  riichiState: boolean
  tilesPerRow?: number
  dim?: boolean
}) {
  const riichiIdx = getRiichiDeclIdx(discards, riichiState)

  if (discards.length === 0) {
    return <span className="text-[9px] text-gray-400/70 italic">捨て牌なし</span>
  }

  return (
    <div className={`flex flex-col gap-[2px] ${dim ? 'opacity-80' : ''}`}>
      {Array.from({ length: Math.ceil(discards.length / tilesPerRow) }, (_, row) => (
        <div key={row} className="flex gap-[2px]">
          {discards.slice(row * tilesPerRow, (row + 1) * tilesPerRow).map((d, col) => {
            const i = row * tilesPerRow + col
            return (
              <TileComponent
                key={i}
                tile={d.tile}
                size="xs"
                className={[
                  d.tsumokiri ? 'opacity-30' : '',
                  i === riichiIdx ? 'ring-1 ring-red-400 ring-offset-0 rounded' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Compact meld badges */
function MeldBadges({ melds }: { melds: Meld[] }) {
  if (melds.length === 0) return null
  return (
    <div className="flex flex-wrap gap-[3px] mt-1">
      {melds.map((meld, i) => (
        <div
          key={i}
          className="flex items-center gap-[2px] bg-amber-50 border border-amber-300/80 rounded px-[3px] py-px"
        >
          {meld.tiles.map((tile, j) => (
            <TileComponent key={j} tile={tile} size="xs" />
          ))}
          <span className="text-[8px] font-bold text-amber-700 ml-[2px]">
            {getMeldTypeLabel(meld.type)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ----------------------------------------------------------------
// Player zones
// ----------------------------------------------------------------

/** Top / bottom full-width zones */
function HorizontalZone({
  label,
  sublabel,
  discards,
  melds,
  riichiState,
  riichiTurn,
  isSubject = false,
}: {
  label: string
  sublabel?: string
  discards: Discard[]
  melds: Meld[]
  riichiState: boolean
  riichiTurn?: number
  isSubject?: boolean
}) {
  return (
    <div
      className={`rounded-lg p-2 ${
        isSubject
          ? 'bg-indigo-900/30 ring-2 ring-yellow-400/80 shadow-[0_0_12px_rgba(250,204,21,0.25)]'
          : 'bg-black/20'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className={`text-[10px] font-bold leading-none ${
            isSubject ? 'text-yellow-300' : 'text-gray-300'
          }`}
        >
          {label}
        </span>
        {sublabel && (
          <span className="text-[9px] text-yellow-400/80 bg-yellow-400/10 border border-yellow-400/30 px-1 rounded leading-none">
            {sublabel}
          </span>
        )}
        {riichiState && <RiichiBadge riichiTurn={riichiTurn} />}
      </div>

      <DiscardGrid discards={discards} riichiState={riichiState} tilesPerRow={6} dim={!isSubject} />
      <MeldBadges melds={melds} />
    </div>
  )
}

/** Left / right narrow side zones */
function SideZone({
  label,
  discards,
  melds,
  riichiState,
  riichiTurn,
}: {
  label: string
  discards: Discard[]
  melds: Meld[]
  riichiState: boolean
  riichiTurn?: number
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-black/20 rounded-lg p-1.5">
      {/* Seat label */}
      <span className="text-[9px] font-bold text-gray-400 leading-none">{label}</span>

      {/* Riichi */}
      {riichiState && (
        <span className="text-[8px] font-bold text-red-400 leading-none">R</span>
      )}

      {/* Tiles: 3 per row (3 × 28px + 2 gaps = 88px ≤ 90px column) */}
      <DiscardGrid discards={discards} riichiState={riichiState} tilesPerRow={3} dim />

      {/* Meld count badge */}
      {melds.length > 0 && (
        <span className="text-[9px] text-amber-400 font-bold leading-none">
          鳴×{melds.length}
        </span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Table center info
// ----------------------------------------------------------------

function TableCenter({
  turn,
  doraIndicators,
  roundWind,
  seatWind,
  honba,
  kyotaku,
}: {
  turn: number
  doraIndicators: TileStr[]
  roundWind?: string
  seatWind?: string
  honba?: number
  kyotaku?: number
}) {
  const doraActual = doraIndicators.map(getDoraTile)

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-2 h-full text-center">
      {/* Round / seat wind */}
      {(roundWind || seatWind) && (
        <div className="text-[10px] text-green-300/80 font-bold leading-none">
          {roundWind && <span>{roundWind}場</span>}
          {seatWind && <span className="ml-1">{seatWind}家</span>}
        </div>
      )}

      {/* Turn + honba */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="bg-black/30 rounded-full px-2.5 py-0.5 border border-white/10">
          <span className="text-[11px] font-bold text-white">{turn}巡目</span>
        </div>
        {(honba != null && honba > 0) || (kyotaku != null && kyotaku > 0) ? (
          <span className="text-[9px] text-gray-400">
            {honba != null && honba > 0 && `${honba}本場`}
            {kyotaku != null && kyotaku > 0 && ` 供託${kyotaku}`}
          </span>
        ) : null}
      </div>

      {/* Dora */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[9px] text-gray-400 leading-none">ドラ表示牌</span>
        <div className="flex gap-[3px] flex-wrap justify-center">
          {doraIndicators.map((t, i) => (
            <TileComponent key={i} tile={t} size="xs" variant="dora" />
          ))}
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {doraActual.map((t, i) => (
            <span key={i} className="text-[9px] font-bold text-amber-300 bg-amber-900/30 px-1 rounded leading-none">
              {getTileLabel(t)}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------
// Discard legend
// ----------------------------------------------------------------

function DiscardLegend({ showRiichi }: { showRiichi: boolean }) {
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="flex items-center gap-1 text-[9px] text-gray-400">
        <span className="inline-block w-4 h-5 bg-white border border-gray-300 rounded text-center leading-5 text-[8px] shadow-sm">
          牌
        </span>
        手出し
      </span>
      <span className="flex items-center gap-1 text-[9px] text-gray-400">
        <span className="inline-block w-4 h-5 bg-white border border-gray-200 rounded text-center leading-5 text-[8px] opacity-30 shadow-sm">
          牌
        </span>
        ツモ切り
      </span>
      {showRiichi && (
        <span className="flex items-center gap-1 text-[9px] text-gray-400">
          <span className="inline-block w-4 h-5 bg-red-50 border border-red-400 rounded text-center leading-5 text-[8px]">
            牌
          </span>
          リーチ宣言
        </span>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

interface MahjongTableProps {
  turn: number
  doraIndicators: TileStr[]
  riichiState: boolean
  riichiTurn?: number
  discards: Discard[]
  melds: Meld[]
  seatWind?: string
  roundWind?: string
  honba?: number
  kyotaku?: number
  players?: PlayerVisibleInfo[]
}

export default function MahjongTable({
  turn,
  doraIndicators,
  riichiState,
  riichiTurn,
  discards,
  melds,
  seatWind,
  roundWind,
  honba,
  kyotaku,
  players,
}: MahjongTableProps) {
  const subjectLabel = seatWind ? `${seatWind}家` : '和了者'

  const toimen   = players?.find((p) => p.seat === '対面')
  const kamicha  = players?.find((p) => p.seat === '上家')
  const shimocha = players?.find((p) => p.seat === '下家')

  // Only render multi-player layout if at least one other player has data
  const hasOtherPlayers = !!(toimen || kamicha || shimocha)

  return (
    <div className="space-y-1.5">
      {/* Legend */}
      <DiscardLegend showRiichi={riichiState} />

      {/* Table */}
      <div className="rounded-2xl overflow-hidden border-[3px] border-amber-900/70 shadow-lg bg-green-900">
        <div className="p-1.5 space-y-1.5">

          {/* TOP: 対面 */}
          {hasOtherPlayers && (
            <div>
              {toimen ? (
                <HorizontalZone
                  label="対面"
                  discards={toimen.discards}
                  melds={toimen.melds}
                  riichiState={toimen.riichiState}
                  riichiTurn={toimen.riichiTurn}
                />
              ) : (
                <div className="h-8 bg-black/10 rounded-lg flex items-center justify-center">
                  <span className="text-[9px] text-gray-500">対面</span>
                </div>
              )}
            </div>
          )}

          {/* MIDDLE: 上家 | Center | 下家 */}
          <div className="flex gap-1.5 items-stretch">
            {/* LEFT: 上家 */}
            {hasOtherPlayers && (
              <div className="w-[90px] shrink-0">
                {kamicha ? (
                  <SideZone
                    label="上家"
                    discards={kamicha.discards}
                    melds={kamicha.melds}
                    riichiState={kamicha.riichiState}
                    riichiTurn={kamicha.riichiTurn}
                  />
                ) : (
                  <div className="h-full bg-black/10 rounded-lg flex items-center justify-center min-h-[80px]">
                    <span className="text-[9px] text-gray-500">上家</span>
                  </div>
                )}
              </div>
            )}

            {/* CENTER: table info */}
            <div className="flex-1 bg-green-800/60 rounded-xl border border-green-700/40 min-h-[100px]">
              <TableCenter
                turn={turn}
                doraIndicators={doraIndicators}
                roundWind={roundWind}
                seatWind={seatWind}
                honba={honba}
                kyotaku={kyotaku}
              />
            </div>

            {/* RIGHT: 下家 */}
            {hasOtherPlayers && (
              <div className="w-[90px] shrink-0">
                {shimocha ? (
                  <SideZone
                    label="下家"
                    discards={shimocha.discards}
                    melds={shimocha.melds}
                    riichiState={shimocha.riichiState}
                    riichiTurn={shimocha.riichiTurn}
                  />
                ) : (
                  <div className="h-full bg-black/10 rounded-lg flex items-center justify-center min-h-[80px]">
                    <span className="text-[9px] text-gray-500">下家</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* BOTTOM: 和了者（subject, highlighted） */}
          <HorizontalZone
            label={subjectLabel}
            sublabel="読みの対象"
            discards={discards}
            melds={melds}
            riichiState={riichiState}
            riichiTurn={riichiTurn}
            isSubject
          />
        </div>
      </div>
    </div>
  )
}
