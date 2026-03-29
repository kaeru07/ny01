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
    <div className="space-y-1.5">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-semibold ${isAnswering ? 'text-gray-300' : 'text-gray-400'}`}>
          {isAnswering ? '待ち牌を選択（複数可）' : '回答した牌'}
        </p>
        <div className="flex items-center gap-2">
          {/* Legend after submission */}
          {!isAnswering && (
            <div className="flex gap-2 text-[9px] text-gray-500">
              <span className="flex items-center gap-0.5">
                <span className="w-2.5 h-2.5 bg-green-100 border border-green-500 inline-block" />
                正解
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2.5 h-2.5 bg-red-50 border border-red-400 inline-block" />
                不正解
              </span>
              <span className="flex items-center gap-0.5">
                <span className="w-2.5 h-2.5 bg-amber-50 border border-amber-400 inline-block" />
                選び忘れ
              </span>
            </div>
          )}
          {isAnswering && (
            <span
              className={`text-[9px] font-bold px-1.5 py-px rounded border ${
                remaining <= 1
                  ? 'border-red-600 text-red-400'
                  : remaining === 2
                  ? 'border-orange-600 text-orange-400'
                  : 'border-gray-600 text-gray-400'
              }`}
            >
              残り{remaining}回
            </span>
          )}
        </div>
      </div>

      {/* Wrong feedback — single line */}
      {showWrongFeedback && (
        <p className="text-[10px] text-orange-400 border-l-2 border-orange-600 pl-2">
          不正解。残り{remaining}回 ／ 薄い牌＝前回の回答
        </p>
      )}

      {/* Tile grid */}
      <div className="bg-gray-900 border border-gray-800 rounded p-1.5 space-y-1">
        {SUIT_ROWS.map(({ label, tiles }) => (
          <div key={label} className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500 w-6 shrink-0 text-right">{label}</span>
            <div className="flex gap-[2px] flex-wrap">
              {tiles.map((tile) => {
                const state = getTileAnswerState(tile)
                const variant = answerStateToVariant(state)
                return (
                  <TileComponent
                    key={tile}
                    tile={tile}
                    size="sm"
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
        <div className="sticky bottom-2 z-20">
          <button
            onClick={onSubmit}
            disabled={selectedTiles.length === 0}
            className="w-full py-2 rounded font-bold text-sm
              bg-indigo-700 text-white border border-indigo-500
              disabled:bg-gray-800 disabled:text-gray-600 disabled:border-gray-700
              hover:bg-indigo-600 active:bg-indigo-800
              transition-colors"
          >
            {selectedTiles.length === 0
              ? '牌を選択してください'
              : `答える（${selectedTiles.length}枚）`}
          </button>
        </div>
      )}
    </div>
  )
}
