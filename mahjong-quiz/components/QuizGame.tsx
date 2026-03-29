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
import MahjongTable from './MahjongTable'
import AnswerPanel from './AnswerPanel'
import ResultPanel from './ResultPanel'

interface QuizGameProps {
  question: QuizQuestion
}

export default function QuizGame({ question }: QuizGameProps) {
  const router = useRouter()
  const {
    phase,
    selectedTiles,
    lastSubmission,
    attemptsUsed,
    maxAttempts,
    wrongAnswers,
    isCleared,
    isFailed,
    toggleTile,
    submit,
    getTileAnswerState,
  } = useQuiz(question)
  const { saveAttempt, loaded } = useHistory()

  const allQuestions = getAllQuestionsSync()
  const questionIndex = allQuestions.findIndex((q) => q.id === question.id)
  const questionNumber = questionIndex + 1

  // Save attempt once on submission
  useEffect(() => {
    if (phase === 'submitted' && loaded) {
      const wrongTriedTiles = [...new Set(wrongAnswers.flat())]
      saveAttempt({
        questionId: question.id,
        selectedTiles: lastSubmission,
        isCorrect: isCleared,
        answeredAt: new Date().toISOString(),
        attemptsUsed,
        maxAttempts,
        wrongTiles: wrongTriedTiles,
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

  const { visibleInfo, answer } = question

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-3 py-1.5 flex items-center justify-between">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-200 flex items-center gap-1">
            ← 問題一覧
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getDifficultyBadgeClass(
                question.difficulty,
              )}`}
            >
              {getDifficultyLabel(question.difficulty)}
            </span>
            <span className="text-xs text-gray-500">
              {questionNumber} / {allQuestions.length}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-2 py-2 space-y-2">
        {/* Title + meta row */}
        <div className="flex flex-wrap items-center gap-1 overflow-x-auto">
          <h1 className="text-xs font-bold text-gray-200 leading-snug shrink-0">
            {question.title}
          </h1>
          <span className={`text-[9px] font-bold px-1 py-px rounded border ${getCategoryBadgeClass(question.category)}`}>
            {getCategoryLabel(question.category)}
          </span>
          {question.sourceType !== 'manual' && (() => {
            const { label, className } = getSourceTypeBadge(question.sourceType)
            return (
              <span className={`text-[9px] font-bold px-1 py-px rounded border ${className}`}>
                {label}
              </span>
            )
          })()}
          {question.sourceMeta && (
            <span className="text-[9px] text-gray-500">
              {question.sourceMeta.round}
              {question.sourceMeta.honba > 0 && `${question.sourceMeta.honba}本場`}
              {question.sourceMeta.kyotaku > 0 && `・供託${question.sourceMeta.kyotaku}`}
            </span>
          )}
          {question.rankTier && (
            <span className="text-[9px] text-gray-600">{question.rankTier}</span>
          )}
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-[9px] bg-gray-800 text-gray-400 px-1 py-px rounded border border-gray-700"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 2D table */}
        <MahjongTable
          turn={visibleInfo.turn}
          doraIndicators={visibleInfo.doraIndicators}
          riichiState={visibleInfo.riichiState}
          riichiTurn={visibleInfo.riichiTurn}
          discards={visibleInfo.discards}
          melds={visibleInfo.melds}
          seatWind={question.sourceMeta?.seatWind}
          roundWind={question.sourceMeta?.roundWind}
          honba={question.sourceMeta?.honba}
          kyotaku={question.sourceMeta?.kyotaku}
          players={visibleInfo.players}
        />

        {/* Divider */}
        <div className="border-t border-gray-800" />

        {/* Quiz section */}
        <AnswerPanel
          phase={phase}
          selectedTiles={selectedTiles}
          attemptsUsed={attemptsUsed}
          maxAttempts={maxAttempts}
          getTileAnswerState={getTileAnswerState}
          onToggle={toggleTile}
          onSubmit={submit}
        />

        {/* Result + hand reveal (after submission) */}
        {phase === 'submitted' && (
          <ResultPanel
            isCorrect={isCleared}
            attemptsUsed={attemptsUsed}
            maxAttempts={maxAttempts}
            waits={answer.waits}
            hand={answer.hand}
            melds={visibleInfo.melds}
            riichiState={visibleInfo.riichiState}
            explanation={answer.explanation}
            onNext={handleNext}
            onBackToList={handleBackToList}
          />
        )}

        {/* Bottom spacer */}
        <div className="pb-2" />
      </main>
    </div>
  )
}
