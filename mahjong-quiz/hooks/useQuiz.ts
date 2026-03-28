'use client'

import { useState } from 'react'
import { TileStr, QuizQuestion, Difficulty } from '@/lib/types'
import { sortTiles } from '@/lib/mahjong-utils'

export type QuizPhase = 'answering' | 'submitted'

export type TileAnswerState =
  | 'hit'
  | 'miss'
  | 'missed_wait'
  | 'neutral'
  | 'selected'
  | 'wrong_tried'

const MAX_ATTEMPTS: Record<Difficulty, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
}

export function useQuiz(question: QuizQuestion) {
  const maxAttempts = question.maxAttempts ?? MAX_ATTEMPTS[question.difficulty]

  const [phase, setPhase] = useState<QuizPhase>('answering')
  const [selectedTiles, setSelectedTiles] = useState<TileStr[]>([])
  const [lastSubmission, setLastSubmission] = useState<TileStr[]>([])
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [wrongAnswers, setWrongAnswers] = useState<TileStr[][]>([])
  const [isCleared, setIsCleared] = useState(false)
  const [isFailed, setIsFailed] = useState(false)

  // Flat list of all tiles that appeared in any wrong submission (preserves dupes for display)
  const wrongTriedTiles = wrongAnswers.flat()

  function toggleTile(tile: TileStr) {
    if (phase !== 'answering') return
    setSelectedTiles((prev) =>
      prev.includes(tile) ? prev.filter((t) => t !== tile) : [...prev, tile],
    )
  }

  function submit() {
    if (selectedTiles.length === 0) return
    const ss = sortTiles(selectedTiles)
    const sw = sortTiles(question.answer.waits)
    const correct = ss.length === sw.length && ss.every((t, i) => t === sw[i])
    const newAttemptsUsed = attemptsUsed + 1

    setLastSubmission(selectedTiles)
    setAttemptsUsed(newAttemptsUsed)

    if (correct) {
      setIsCleared(true)
      setPhase('submitted')
    } else {
      setWrongAnswers((prev) => [...prev, selectedTiles])
      setSelectedTiles([])
      if (newAttemptsUsed >= maxAttempts) {
        setIsFailed(true)
        setPhase('submitted')
      }
      // else stay in 'answering' — user gets another try
    }
  }

  function getTileAnswerState(tile: TileStr): TileAnswerState {
    const isWait = question.answer.waits.includes(tile)

    if (phase === 'submitted') {
      if (isCleared) {
        const wasSelected = lastSubmission.includes(tile)
        if (wasSelected && isWait) return 'hit'
        if (wasSelected && !isWait) return 'miss'
        if (!wasSelected && isWait) return 'missed_wait'
        return 'neutral'
      } else {
        // Failed — highlight all correct waits; show last wrong selection as miss
        if (isWait) return 'missed_wait'
        if (lastSubmission.includes(tile)) return 'miss'
        return 'neutral'
      }
    }

    // During answering
    const isSelected = selectedTiles.includes(tile)
    if (isSelected) return 'selected'
    if (wrongTriedTiles.includes(tile)) return 'wrong_tried'
    return 'neutral'
  }

  return {
    phase,
    selectedTiles,
    lastSubmission,
    attemptsUsed,
    maxAttempts,
    wrongAnswers,
    wrongTriedTiles,
    isCleared,
    isFailed,
    toggleTile,
    submit,
    getTileAnswerState,
  }
}
