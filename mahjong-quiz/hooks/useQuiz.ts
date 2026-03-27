'use client'

import { useState } from 'react'
import { TileStr, QuizQuestion } from '@/lib/types'
import { sortTiles } from '@/lib/mahjong-utils'

export type QuizPhase = 'answering' | 'submitted'

export type TileAnswerState = 'hit' | 'miss' | 'missed_wait' | 'neutral' | 'selected'

export function useQuiz(question: QuizQuestion) {
  const [phase, setPhase] = useState<QuizPhase>('answering')
  const [selectedTiles, setSelectedTiles] = useState<TileStr[]>([])
  const [isCorrect, setIsCorrect] = useState(false)

  function toggleTile(tile: TileStr) {
    if (phase !== 'answering') return
    setSelectedTiles((prev) =>
      prev.includes(tile) ? prev.filter((t) => t !== tile) : [...prev, tile],
    )
  }

  function submit() {
    if (selectedTiles.length === 0) return
    const ss = sortTiles(selectedTiles)
    const sw = sortTiles(question.waits)
    const correct =
      ss.length === sw.length && ss.every((t, i) => t === sw[i])
    setIsCorrect(correct)
    setPhase('submitted')
  }

  function getTileAnswerState(tile: TileStr): TileAnswerState {
    const isWait = question.waits.includes(tile)
    const isSelected = selectedTiles.includes(tile)
    if (phase === 'submitted') {
      if (isSelected && isWait) return 'hit'
      if (isSelected && !isWait) return 'miss'
      if (!isSelected && isWait) return 'missed_wait'
      return 'neutral'
    }
    return isSelected ? 'selected' : 'neutral'
  }

  return {
    phase,
    selectedTiles,
    isCorrect,
    toggleTile,
    submit,
    getTileAnswerState,
  }
}
