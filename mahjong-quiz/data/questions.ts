import { QuizQuestion } from '@/lib/types'
import { basicQuestions } from './basicQuestions'
import { kifuQuestions } from './kifuQuestions'

export const questions: QuizQuestion[] = [...basicQuestions, ...kifuQuestions]
