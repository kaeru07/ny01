/**
 * Data access layer for quiz questions.
 * All async functions can be swapped for Supabase later without changing call sites.
 */

import { QuizQuestion, QuizCategory } from './types'
import { questions } from '@/data/questions'

export async function getAllQuestions(): Promise<QuizQuestion[]> {
  return questions
}

export async function getQuestionById(id: string): Promise<QuizQuestion | undefined> {
  return questions.find((q) => q.id === id)
}

export async function getQuestionsByCategory(
  category: QuizCategory,
): Promise<QuizQuestion[]> {
  return questions.filter((q) => q.category === category)
}

// ─── Sync helpers (client-side use) ─────────────────────────────────────────

export function getAllQuestionsSync(): QuizQuestion[] {
  return questions
}

export function getQuestionByIdSync(id: string): QuizQuestion | undefined {
  return questions.find((q) => q.id === id)
}

export function getQuestionsByCategorySync(category: QuizCategory): QuizQuestion[] {
  return questions.filter((q) => q.category === category)
}

export function getNextQuestionId(currentId: string): string {
  const idx = questions.findIndex((q) => q.id === currentId)
  const next = (idx + 1) % questions.length
  return questions[next].id
}

export function getRandomQuestionId(excludeId?: string): string {
  const pool = excludeId ? questions.filter((q) => q.id !== excludeId) : questions
  const src = pool.length > 0 ? pool : questions
  return src[Math.floor(Math.random() * src.length)].id
}

export function getRandomQuestionIdByCategory(
  category: QuizCategory,
  excludeId?: string,
): string {
  const pool = questions.filter(
    (q) => q.category === category && q.id !== excludeId,
  )
  const src = pool.length > 0 ? pool : questions.filter((q) => q.category === category)
  return src[Math.floor(Math.random() * src.length)].id
}
