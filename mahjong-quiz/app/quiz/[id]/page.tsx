import { notFound } from 'next/navigation'
import { getQuestionById } from '@/lib/repository'
import QuizGame from '@/components/QuizGame'

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const question = await getQuestionById(id)
  if (!question) notFound()
  return <QuizGame question={question} />
}
