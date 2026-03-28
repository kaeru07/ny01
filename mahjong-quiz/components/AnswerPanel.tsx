'use client'

import TileComponent, { TileVariant } from './TileComponent'
import { ALL_TILES } from '@/lib/mahjong-utils'
import { TileStr } from '@/lib/types'
import { TileAnswerState } from '@/hooks/useQuiz'

const MAN  = ALL_TILES.slice(0, 9)
const PIN  = ALL_TILES.slice(9, 18)
const SOU  = ALL_TILES.slice(18, 27)
const JIHAI = ALL_TILES.slice(27)

const SUIT_ROWS = [
  { label: '萬子', tiles: MAN },
  { label: '筒子', tiles: PIN },
  { label: '索子', tiles: SOU },
  { label: '字牌', tiles: JIHAI },
]

function answerStateToVariant(state: TileAnswerState): TileVariant {
  switch (state) {
    case 'selected':     return 'selected'
    case 'hit':          return 'hit'
    case 'miss':         return 'miss'
    case 'missed_wait':  return 'missed'
    case 'wrong_tried':  return 'tried'
    default:             return 'default'
  }
}

interface AnswerPanelProps {
  phase: 'answering' | 'submitted'
  selectedTiles: TileStr[]
  attemptsUsed: number
  maxAttempts: number
  getTileAnswerState: (tile: TileStr) => TileAnswerState
  onToggle: (tile: TileStr) => void
  onSubmit: () => void
}

export default function AnswerPanel({
  phase,
  selectedTiles,
  attemptsUsed,
  maxAttempts,
  getTileAnswerState,
  onToggle,
  onSubmit,
}: AnswerPanelProps) {
  const isAnswering = phase === 'answering'
  const remaining = maxAttempts - attemptsUsed
  const showWrongFeedback = isAnswering && attemptsUsed > 0

  return (
    <div className="space-y-3">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold ${isAnswering ? 'text-gray-300' : 'text-gray-400'}`}>
          {isAnswering ? '待ち牌をすべて選んでください（複数可）' : '回答した牌'}
        </p>
        {isAnswering && (
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              remaining <= 1
                ? 'bg-red-900/50 border-red-600 text-red-400'
                : remaining === 2
                ? 'bg-orange-900/50 border-orange-600 text-orange-400'
                : 'bg-gray-800 border-gray-600 text-gray-400'
            }`}
          >
            残り{remaining}回
          </span>
        )}
      </div>

      {/* Wrong feedback */}
      {showWrongFeedback && (
        <div className="bg-orange-950/60 border border-orange-700/60 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-orange-400">不正解。残り{remaining}回です</p>
          <p className="text-[10px] text-orange-600 mt-0.5">
            薄くなった牌は前回の回答に含まれていた牌です
          </p>
        </div>
      )}

      {/* Legend after submission */}
      {!isAnswering && (
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-green-100 border border-green-500 inline-block" />
            正解
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-50 border border-red-400 inline-block" />
            不正解
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-amber-50 border border-amber-400 inline-block" />
            選び忘れ
          </span>
        </div>
      )}

      {/* Legend during answering (after 1+ wrong) */}
      {isAnswering && attemptsUsed > 0 && (
        <div className="flex flex-wrap gap-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 opacity-50 inline-block" />
            過去の回答に含めた牌
          </span>
        </div>
      )}

      {/* Tile grid */}
      <div className="bg-gray-900 rounded-xl p-2 space-y-1.5">
        {SUIT_ROWS.map(({ label, tiles }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-[10px] text-gray-500 w-7 shrink-0 text-right">{label}</span>
            <div className="flex gap-1 flex-wrap">
              {tiles.map((tile) => {
                const state = getTileAnswerState(tile)
                const variant = answerStateToVariant(state)
                return (
                  <TileComponent
                    key={tile}
                    tile={tile}
                    size="md"
                    variant={variant}
                    onClick={isAnswering ? () => onToggle(tile) : undefined}
                    disabled={!isAnswering}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit — sticky on mobile */}
      {isAnswering && (
        <div className="sticky bottom-3 z-20">
          <button
            onClick={onSubmit}
            disabled={selectedTiles.length === 0}
            className="w-full py-3.5 rounded-xl font-bold text-base shadow-lg
              bg-indigo-600 text-white
              disabled:bg-gray-700 disabled:text-gray-500
              hover:bg-indigo-500 active:bg-indigo-700
              transition-colors"
          >
            {selectedTiles.length === 0
              ? '牌を選んでください'
              : `答える（${selectedTiles.length}枚選択中）`}
          </button>
        </div>
      )}
    </div>
  )
}
