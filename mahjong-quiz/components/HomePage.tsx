'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  getAllQuestionsSync,
  getQuestionsByCategorySync,
  getRandomQuestionId,
  getRandomQuestionIdByCategory,
} from '@/lib/repository'
import {
  getDifficultyLabel,
  getDifficultyBadgeClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getSourceTypeBadge,
} from '@/lib/mahjong-utils'
import { useHistory } from '@/hooks/useHistory'
import { QuizCategory, QuizQuestion } from '@/lib/types'

const CATEGORIES: { id: QuizCategory; description: string }[] = [
  { id: 'kifu',  description: '天鳳・雀魂の上位局の捨て牌から推理する' },
  { id: 'basic', description: '基本的な待ち形を捨て牌から読む練習' },
]

// ─── Question card (shared between sections) ─────────────────────────────────

function QuestionCard({
  question,
  index,
  solved,
  tried,
}: {
  question: QuizQuestion
  index: number
  solved: boolean
  tried: boolean
}) {
  const { label: sourceLabel, className: sourceClass } = getSourceTypeBadge(
    question.sourceType,
  )

  return (
    <Link
      href={`/quiz/${question.id}`}
      className="flex items-center gap-3 bg-white rounded-xl border border-gray-200
        p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
    >
      {/* Number */}
      <span
        className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 text-xs
          font-bold flex items-center justify-center shrink-0 group-hover:bg-indigo-50"
      >
        {index + 1}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{question.title}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getDifficultyBadgeClass(
              question.difficulty,
            )}`}
          >
            {getDifficultyLabel(question.difficulty)}
          </span>
          {question.sourceType !== 'manual' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sourceClass}`}>
              {sourceLabel}
            </span>
          )}
          {question.sourceMeta && (
            <span className="text-[10px] text-gray-400 px-1 py-0.5">
              {question.sourceMeta.round}
            </span>
          )}
          {question.tags.slice(0, 1).map((tag) => (
            <span
              key={tag}
              className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="shrink-0">
        {solved ? (
          <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
            ✓
          </span>
        ) : tried ? (
          <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">
            ✗
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center">
            →
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  categoryId,
  description,
  questions,
  getLatestAttempt,
  loaded,
  onRandomClick,
}: {
  categoryId: QuizCategory
  description: string
  questions: QuizQuestion[]
  getLatestAttempt: (id: string) => { isCorrect: boolean } | undefined
  loaded: boolean
  onRandomClick: () => void
}) {
  const solved = loaded
    ? questions.filter((q) => getLatestAttempt(q.id)?.isCorrect).length
    : 0

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded border ${getCategoryBadgeClass(categoryId)}`}
            >
              {getCategoryLabel(categoryId)}
            </span>
            <span className="text-xs text-gray-400">
              {loaded ? `${solved}/${questions.length}クリア` : `${questions.length}問`}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onRandomClick}
          className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200
            text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors font-medium"
        >
          🎲 ランダム
        </button>
      </div>

      {/* Question list */}
      <div className="space-y-2">
        {questions.map((q, i) => {
          const attempt = loaded ? getLatestAttempt(q.id) : undefined
          return (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              solved={attempt?.isCorrect ?? false}
              tried={!!attempt}
            />
          )
        })}
      </div>
    </section>
  )
}

// ─── Home page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const { getStats, getLatestAttempt, loaded } = useHistory()

  const stats = getStats()
  const allQuestions = getAllQuestionsSync()
  const totalCount = allQuestions.length

  function handleRandom() {
    router.push(`/quiz/${getRandomQuestionId()}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-5">
          <h1 className="text-xl font-extrabold text-gray-900">麻雀待ち読みクイズ</h1>
          <p className="text-sm text-gray-500 mt-1">
            捨て牌・副露・リーチから相手の待ち牌を読む推理クイズ
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-5">
        {/* Stats */}
        {loaded && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex justify-around text-center">
              <div>
                <p className="text-2xl font-extrabold text-indigo-600">{stats.solvedCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">クリア / {totalCount}問</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-2xl font-extrabold text-gray-800">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">挑戦回数</p>
              </div>
              <div className="w-px bg-gray-200" />
              <div>
                <p className="text-2xl font-extrabold text-emerald-600">
                  {stats.total > 0 ? `${stats.accuracy}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">正解率</p>
              </div>
            </div>
          </div>
        )}

        {/* Main action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleRandom}
            className="flex-1 py-4 rounded-xl font-bold text-base bg-indigo-600 text-white
              hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
          >
            🎲 ランダム出題
          </button>
          <a
            href="#list"
            className="flex-1 py-4 rounded-xl font-bold text-base bg-white text-gray-700
              border border-gray-300 hover:bg-gray-50 active:bg-gray-100 transition-colors text-center"
          >
            📋 問題一覧
          </a>
        </div>

        {/* Problem list by category */}
        <div id="list" className="space-y-6">
          {CATEGORIES.map(({ id, description }) => {
            const qs = getQuestionsByCategorySync(id)
            return (
              <CategorySection
                key={id}
                categoryId={id}
                description={description}
                questions={qs}
                getLatestAttempt={getLatestAttempt}
                loaded={loaded}
                onRandomClick={() =>
                  router.push(`/quiz/${getRandomQuestionIdByCategory(id)}`)
                }
              />
            )
          })}
        </div>

        <p className="text-xs text-center text-gray-400 pb-6">
          問題は随時追加予定 · 正解率は端末のlocalStorageに保存されます
        </p>
      </main>
    </div>
  )
}
