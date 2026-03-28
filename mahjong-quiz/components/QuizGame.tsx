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
import BoardInfo from './BoardInfo'
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
              {question.sourceMeta.kyotaku > 0 && `・供託${question.sourceMeta.kyotaku}`}
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

        {/* Challenge prompt */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
          <p className="text-sm font-semibold text-indigo-800">
            この対局者の待ち牌を読んでください
          </p>
          <p className="text-xs text-indigo-600 mt-0.5">
            手牌は非公開です。捨て牌・副露・リーチなどの情報から推理してください。
          </p>
        </div>

        {/* Board info: discards, melds, riichi, dora, other players */}
        <BoardInfo
          turn={visibleInfo.turn}
          doraIndicators={visibleInfo.doraIndicators}
          riichiState={visibleInfo.riichiState}
          riichiTurn={visibleInfo.riichiTurn}
          discards={visibleInfo.discards}
          melds={visibleInfo.melds}
          seatWind={question.sourceMeta?.seatWind}
          players={visibleInfo.players}
        />

        {/* Divider */}
        <div className="border-t border-gray-200" />

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
        <div className="pb-4" />
      </main>
    </div>
  )
}
