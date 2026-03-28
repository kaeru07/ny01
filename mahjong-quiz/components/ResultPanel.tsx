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
    <div className="space-y-4">
      {/* Verdict */}
      <div
        className={`rounded-xl p-4 border-2 ${
          isCorrect
            ? 'bg-green-950/60 border-green-600'
            : 'bg-red-950/60 border-red-700'
        }`}
      >
        <p className={`text-xl font-extrabold mb-1 ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
          {isCorrect ? '✓ 正解！' : '✗ 不正解'}
        </p>
        {isCorrect && attemptsUsed === 1 && (
          <p className="text-sm text-green-500 mb-2">一発正解！（最大{maxAttempts}回）</p>
        )}
        {isCorrect && attemptsUsed > 1 && (
          <p className="text-sm text-green-500 mb-2">{attemptsUsed}回目で正解（最大{maxAttempts}回）</p>
        )}
        {!isCorrect && (
          <p className="text-sm text-red-500 mb-2">{maxAttempts}回すべて使い切りました</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-300">正解の待ち牌：</span>
          <div className="flex gap-1 flex-wrap">
            {waits.map((tile, i) => (
              <TileComponent key={i} tile={tile} size="md" variant="hit" />
            ))}
          </div>
          <span className="text-sm text-gray-500">（{waits.length}種）</span>
        </div>
      </div>

      {/* Actual hand reveal */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">実際の手牌（答え合わせ）</p>
        <HandDisplay hand={hand} melds={melds} riichiState={riichiState} />
      </div>

      {/* Explanation */}
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
        <p className="text-sm font-bold text-gray-300 mb-2">解説</p>
        <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
          {explanation}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 rounded-xl font-bold text-base bg-indigo-600 text-white
            hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
        >
          次の問題 →
        </button>
        <button
          onClick={onBackToList}
          className="flex-1 py-3 rounded-xl font-bold text-base bg-gray-800 text-gray-300
            border border-gray-700 hover:bg-gray-700 transition-colors"
        >
          問題一覧
        </button>
      </div>
    </div>
  )
}
