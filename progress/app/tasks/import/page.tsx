export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress, readProjectTasks } from '@/lib/progress-reader'
import { readGoals } from '@/lib/goal-reader'
import JsonImportManager from '@/components/tasks/JsonImportManager'

export default async function TasksImportPage() {
  const [progressData, tasksData, goalsData] = await Promise.all([
    readAppProgress(),
    readProjectTasks(),
    readGoals(),
  ])

  const projects = progressData.projects.map((p) => ({ id: p.id, name: p.name }))
  const goals = goalsData.goals
    .filter((goal) => goal.status === 'active' || goal.status === 'paused')
    .map((goal) => ({ id: goal.id, title: goal.title, projectId: goal.projectId, phases: goal.phases.map((phase) => ({ id: phase.id, title: phase.title })) }))

  const existingTasks = tasksData.projects.flatMap((pt) =>
    pt.tasks.map((t) => ({
      title: t.title,
      status: t.status,
      targetPath: t.targetPath,
    }))
  )

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">JSON一括取り込み</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            ChatGPT / ClaudeからのJSON出力をまとめてToDoに取り込む
          </p>
        </div>
        <Link
          href="/tasks"
          className="flex-shrink-0 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          ← ToDo一覧
        </Link>
      </header>

      <JsonImportManager projects={projects} goals={goals} existingTasks={existingTasks} />
    </div>
  )
}
