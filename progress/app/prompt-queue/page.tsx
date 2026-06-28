export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { readAppProgress } from '@/lib/progress-reader'
import { readGoals } from '@/lib/goal-reader'
import { buildPromptQueueView } from '@/lib/prompt-queue'
import { PromptQueueBoard } from '@/components/prompt-queue/PromptQueueBoard'

export default async function PromptQueuePage() {
  const [view, progress, goalsData] = await Promise.all([
    buildPromptQueueView(),
    readAppProgress(),
    readGoals(),
  ])
  const projects = progress.projects.map((project) => ({ id: project.id, name: project.name }))
  const goals = goalsData.goals
    .filter((goal) => goal.status !== 'archived')
    .map((goal) => ({ id: goal.id, title: goal.title }))

  return (
    <div className="space-y-4 px-4 pb-5 pt-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Prompt Queue</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            作業プロンプト貯蔵庫。ProjectとGoal進捗に紐づけて、次に使う指示を貯めます。
          </p>
        </div>
        <Link
          href="/queue"
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          自動実行キューへ
        </Link>
      </header>

      <PromptQueueBoard
        items={view.items}
        nextCandidates={view.nextCandidates}
        projects={projects}
        goals={goals}
      />
    </div>
  )
}
