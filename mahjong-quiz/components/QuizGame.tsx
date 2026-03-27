'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { QuizQuestion } from '@/lib/types'
import {
  getDifficultyLabel,
  getDifficultyBadgeClass,
  getCategoryLabel,
  getCategoryBadgeClass,
  getSourceTypeBadge,
} from '@/lib/mahjong-utils'
import { getNextQuestionId } from '@/lib/repository'
import { getAllQuestionsSync } from '@/lib/repository'
import { useQuiz } from '@/hooks/useQuiz'
import { useHistory } from '@/hooks/useHistory'
import HandDisplay from './HandDisplay'
import BoardInfo from './BoardInfo'
import AnswerPanel from './AnswerPanel'
import ResultPanel from './ResultPanel'

interface QuizGameProps {
  question: QuizQuestion
}

export default function QuizGame({ question }: QuizGameProps) {
  const router = useRouter()
  const { phase, selectedTiles, isCorrect, toggleTile, submit, getTileAnswerState } =
    useQuiz(question)
  const { saveAttempt, loaded } = useHistory()

  const allQuestions = getAllQuestionsSync()
  const questionIndex = allQuestions.findIndex((q) => q.id === question.id)
  const questionNumber = questionIndex + 1

  // Save attempt once on submission
  useEffect(() => {
    if (phase === 'submitted' && loaded) {
      saveAttempt({
        questionId: question.id,
        selectedTiles,
        isCorrect,
        answeredAt: new Date().toISOString(),
      })
    }
    // Only run when phase transitions to 'submitted'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function handleNext() {
    const nextId = getNextQuestionId(question.id)
    router.push(`/quiz/${nextId}`)
  }

  function handleBackToList() {
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            ← 問題一覧
          </Link>
          <span className="text-sm text-gray-500">
            問題 {questionNumber} / {allQuestions.length}
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Title + Difficulty */}
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-base font-bold text-gray-900 leading-snug">
            {question.title}
          </h1>
          <span
            className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded border ${getDifficultyBadgeClass(
              question.difficulty,
            )}`}
          >
            {getDifficultyLabel(question.difficulty)}
          </span>
        </div>

        {/* Category + Source badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadgeClass(question.category)}`}>
            {getCategoryLabel(question.category)}
          </span>
          {question.sourceType !== 'manual' && (() => {
            const { label, className } = getSourceTypeBadge(question.sourceType)
            return (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${className}`}>
                {label}
              </span>
            )
          })()}
          {question.sourceMeta && (
            <span className="text-[10px] text-gray-500">
              {question.sourceMeta.round}
              {question.sourceMeta.honba > 0 && `${question.sourceMeta.honba}本場`}
              {question.sourceMeta.seatWind && `・${question.sourceMeta.seatWind}家`}
            </span>
          )}
          {question.rankTier && (
            <span className="text-[10px] text-gray-400">{question.rankTier}</span>
          )}
        </div>

        {/* Tags */}
        {question.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Board info */}
        <BoardInfo
          turn={question.turn}
          doraIndicators={question.doraIndicators}
          riichiState={question.riichiState}
          discards={question.discards}
        />

        {/* Hand */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            手牌（13枚・テンパイ）
          </p>
          <HandDisplay
            hand={question.hand}
            melds={question.melds}
            riichiState={question.riichiState}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Quiz section */}
        {phase === 'answering' ? (
          <AnswerPanel
            phase={phase}
            selectedTiles={selectedTiles}
            getTileAnswerState={getTileAnswerState}
            onToggle={toggleTile}
            onSubmit={submit}
          />
        ) : (
          <>
            <AnswerPanel
              phase={phase}
              selectedTiles={selectedTiles}
              getTileAnswerState={getTileAnswerState}
              onToggle={toggleTile}
              onSubmit={submit}
            />
            <ResultPanel
              isCorrect={isCorrect}
              waits={question.waits}
              explanation={question.explanation}
              onNext={handleNext}
              onBackToList={handleBackToList}
            />
          </>
        )}

        {/* Bottom spacer */}
        <div className="pb-4" />
      </main>
    </div>
  )
}
