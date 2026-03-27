'use client'

import { useState, useEffect, useCallback } from 'react'
import { QuizAttempt } from '@/lib/types'

const STORAGE_KEY = 'mahjong-quiz-history-v1'

export function useHistory() {
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setAttempts(JSON.parse(raw))
    } catch {
      // ignore parse errors
    }
    setLoaded(true)
  }, [])

  const saveAttempt = useCallback(
    (attempt: QuizAttempt) => {
      setAttempts((prev) => {
        const next = [...prev, attempt]
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        } catch {
          // quota exceeded or similar
        }
        return next
      })
    },
    [],
  )

  function getLatestAttempt(questionId: string): QuizAttempt | undefined {
    return [...attempts].reverse().find((a) => a.questionId === questionId)
  }

  function getStats() {
    const total = attempts.length
    const correct = attempts.filter((a) => a.isCorrect).length
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const solvedIds = new Set(
      attempts.filter((a) => a.isCorrect).map((a) => a.questionId),
    )
    return { total, correct, accuracy, solvedCount: solvedIds.size }
  }

  return { attempts, loaded, saveAttempt, getLatestAttempt, getStats }
}
