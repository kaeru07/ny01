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
      {/* Attempts counter */}
      {isAnswering && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            待ち牌をすべて選んでください（複数可）
          </p>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
            remaining <= 1
              ? 'bg-red-50 border-red-300 text-red-700'
              : remaining === 2
              ? 'bg-orange-50 border-orange-300 text-orange-700'
              : 'bg-gray-100 border-gray-300 text-gray-600'
          }`}>
            残り{remaining}回
          </span>
        </div>
      )}

      {/* Wrong answer feedback */}
      {showWrongFeedback && (
        <div className="bg-orange-50 border border-orange-300 rounded-lg px-3 py-2">
          <p className="text-sm font-bold text-orange-800">
            不正解。残り{remaining}回です
          </p>
          <p className="text-xs text-orange-600 mt-0.5">
            薄くなった牌は前回の回答に含まれていた牌です
          </p>
        </div>
      )}

      <div>
        {/* Submitted header */}
        {!isAnswering && (
          <p className="text-sm font-semibold text-gray-700 mb-2">回答した牌</p>
        )}

        {/* Legend (after submission) */}
        {!isAnswering && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
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

        {/* Legend (during answering, after 1+ wrong) */}
        {isAnswering && attemptsUsed > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-300 opacity-50 inline-block" />
              過去の回答に含めた牌
            </span>
          </div>
        )}

        {/* Tile grid */}
        <div className="space-y-2">
          {SUIT_ROWS.map(({ label, tiles }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-7 shrink-0 text-right">
                {label}
              </span>
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
      </div>

      {/* Submit button */}
      {isAnswering && (
        <button
          onClick={onSubmit}
          disabled={selectedTiles.length === 0}
          className="w-full py-3 rounded-xl font-bold text-base
            bg-indigo-600 text-white
            disabled:bg-gray-200 disabled:text-gray-400
            hover:bg-indigo-700 active:bg-indigo-800
            transition-colors"
        >
          {selectedTiles.length === 0 ? '牌を選んでください' : `答える（${selectedTiles.length}枚選択中）`}
        </button>
      )}
    </div>
  )
}
