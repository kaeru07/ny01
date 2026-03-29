import TileComponent from './TileComponent'
import HandDisplay from './HandDisplay'
import { TileStr, Meld } from '@/lib/types'

interface ResultPanelProps {
  isCorrect: boolean
  attemptsUsed: number
  maxAttempts: number
  waits: TileStr[]
  hand: TileStr[]
  melds: Meld[]
  riichiState?: boolean
  explanation: string
  onNext: () => void
  onBackToList: () => void
}

export default function ResultPanel({
  isCorrect,
  attemptsUsed,
  maxAttempts,
  waits,
  hand,
  melds,
  riichiState = false,
  explanation,
  onNext,
  onBackToList,
}: ResultPanelProps) {
  return (
    <div className="space-y-2">
      {/* Verdict */}
      <div
        className={`rounded p-2 border ${
          isCorrect
            ? 'border-green-700 bg-green-950/40'
            : 'border-red-800 bg-red-950/40'
        }`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-bold ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
            {isCorrect ? '✓ 正解' : '✗ 不正解'}
          </span>
          {isCorrect && (
            <span className="text-[10px] text-green-600">
              {attemptsUsed === 1 ? `一発正解（最大${maxAttempts}回）` : `${attemptsUsed}回目（最大${maxAttempts}回）`}
            </span>
          )}
          {!isCorrect && (
            <span className="text-[10px] text-red-600">{maxAttempts}回使い切り</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className="text-[10px] text-gray-400">待ち牌:</span>
          <div className="flex gap-[2px] flex-wrap">
            {waits.map((tile, i) => (
              <TileComponent key={i} tile={tile} size="sm" variant="hit" />
            ))}
          </div>
          <span className="text-[10px] text-gray-500">{waits.length}種</span>
        </div>
      </div>

      {/* Actual hand reveal */}
      <div className="bg-gray-900 border border-gray-800 rounded p-2">
        <p className="text-[10px] font-semibold text-gray-500 mb-1.5">実際の手牌</p>
        <HandDisplay hand={hand} melds={melds} riichiState={riichiState} />
      </div>

      {/* Explanation */}
      <div className="bg-gray-900 border border-gray-800 rounded p-2">
        <p className="text-[10px] font-bold text-gray-400 mb-1">解説</p>
        <div className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">
          {explanation}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <button
          onClick={onNext}
          className="flex-1 py-1.5 rounded font-bold text-sm bg-indigo-700 text-white border border-indigo-500
            hover:bg-indigo-600 active:bg-indigo-800 transition-colors"
        >
          次の問題 →
        </button>
        <button
          onClick={onBackToList}
          className="flex-1 py-1.5 rounded font-bold text-sm bg-gray-800 text-gray-300
            border border-gray-700 hover:bg-gray-700 transition-colors"
        >
          問題一覧
        </button>
      </div>
    </div>
  )
}
