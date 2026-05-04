export const dynamic = 'force-dynamic'

import { readProjectTasks, readAppProgress } from '@/lib/progress-reader'
import { readWorkQueue } from '@/lib/session-reader'
import TodoManager from '@/components/tasks/TodoManager'
import type { TodoTask } from '@/components/tasks/TodoManager'
import type { TaskAssignee } from '@/types/progress'
import Link from 'next/link'

export default async function TasksPage() {
  const [tasksData, progressData, queueData] = await Promise.all([
    readProjectTasks(),
    readAppProgress(),
    readWorkQueue(),
  ])

  const projectMap = Object.fromEntries(progressData.projects.map((p) => [p.id, p.name]))

  const tasks: TodoTask[] = tasksData.projects.flatMap((pt) =>
    pt.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      assignee: (t.assignee ?? 'claude') as TaskAssignee,
      memo: t.memo ?? '',
      taskPrompt: t.taskPrompt,
      projectId: pt.projectId,
      projectName: projectMap[pt.projectId] ?? pt.projectId,
      updatedAt: t.updatedAt,
      doneCriteria: t.doneCriteria,
      allowed: t.allowed,
      forbidden: t.forbidden,
      risk: t.risk,
      blockedReason: t.blockedReason,
      unblockAction: t.unblockAction,
      nextQuestion: t.nextQuestion,
      targetPath: t.targetPath,
      targetApp: t.targetApp,
    }))
  ).sort((a, b) => {
    const statusOrder: Record<string, number> = {
      pending_approval: 0,
      in_progress: 1,
      blocked: 2,
      todo: 3,
      backlog: 4,
      impl_done: 5,
      local_done: 6,
      done: 9,
      skipped: 10,
      deleted: 11,
    }
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    const so = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
    if (so !== 0) return so
    return (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
  })

  const projects = progressData.projects.map((p) => ({ id: p.id, name: p.name }))

  const queuedTaskIds = queueData.items
    .filter((i) => i.status === 'queued' || i.status === 'in_progress')
    .map((i) => i.taskId)

  const queueCount = queueData.items.filter((i) => i.status === 'queued' || i.status === 'in_progress').length

  return (
    <div className="px-4 pt-6 pb-4 space-y-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ToDo管理</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {tasks.length} 件 · 着手判定もここで管理
          </p>
        </div>
        {queueCount > 0 && (
          <Link
            href="/queue"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-medium hover:bg-violet-700 transition-colors"
          >
            今日の作業へ ({queueCount})
          </Link>
        )}
      </header>

      <TodoManager tasks={tasks} projects={projects} queuedTaskIds={queuedTaskIds} />
    </div>
  )
}
