export const dynamic = 'force-dynamic'

import { readProjectTasks, readAppProgress } from '@/lib/progress-reader'
import { readGoals } from '@/lib/goal-reader'
import { readWorkQueue } from '@/lib/session-reader'
import TodoManager from '@/components/tasks/TodoManager'
import GoalTodoAddForm from '@/components/goals/GoalTodoAddForm'
import FilterBar from '@/components/newux/FilterBar'
import FilterChips from '@/components/newux/FilterChips'
import { buildProgressFilterUrl, parseProgressFilters, updateFilterParam } from '@/lib/progress-filters'
import type { TodoTask } from '@/components/tasks/TodoManager'
import type { TaskAssignee } from '@/types/progress'
import Link from 'next/link'

function matchesTask(task: TodoTask, q?: string): boolean {
  if (!q) return true
  const haystack = [task.title, task.memo, task.taskPrompt, task.projectName, task.targetApp, task.blockedReason].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

export default async function TasksPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const [tasksData, progressData, queueData, goalsData] = await Promise.all([
    readProjectTasks(),
    readAppProgress(),
    readWorkQueue(),
    readGoals(),
  ])
  const filters = parseProgressFilters(searchParams)

  const projectMap = Object.fromEntries(progressData.projects.map((p) => [p.id, p.name]))

  const allTasks: TodoTask[] = tasksData.projects.flatMap((pt) =>
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
  ).filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false
    if (filters.status && task.status !== filters.status) return false
    if (!matchesTask(task, filters.q)) return false
    return true
  }).sort((a, b) => {
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
  const goalOptions = goalsData.goals
    .filter((goal) => goal.status === 'active' || goal.status === 'paused')
    .map((goal) => ({ id: goal.id, title: goal.title, phases: goal.phases.map((phase) => ({ id: phase.id, title: phase.title })) }))
  const statusOptions = Array.from(new Set(tasksData.projects.flatMap((pt) => pt.tasks.map((task) => task.status))))
    .sort()
    .map((status) => ({ value: status, label: status }))

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
            全{tasksData.projects.reduce((sum, project) => sum + project.tasks.length, 0)}件中 {allTasks.length}件表示 · 着手判定もここで管理
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

      <FilterBar
        basePath="/tasks"
        filters={filters}
        quickFilters={[
          { key: 'all', label: 'すべて', patch: { status: undefined, projectId: undefined, q: undefined }, active: !filters.status && !filters.projectId && !filters.q },
          { key: 'todo', label: 'todo', patch: { status: 'todo' }, active: filters.status === 'todo' },
          { key: 'blocked', label: 'blocked', patch: { status: 'blocked' }, active: filters.status === 'blocked' },
          { key: 'done', label: 'done', patch: { status: 'done' }, active: filters.status === 'done' },
        ]}
        selectFilters={[
          { key: 'projectId', label: 'Project', placeholder: 'すべてのProject', options: projects.map((project) => ({ value: project.id, label: project.name })) },
          { key: 'status', label: 'status', placeholder: 'すべての状態', options: statusOptions },
        ]}
        showSearch
      />
      <FilterChips
        clearHref="/tasks"
        chips={[
          { key: 'projectId', label: `Project: ${projects.find((project) => project.id === filters.projectId)?.name ?? filters.projectId}`, active: Boolean(filters.projectId), href: buildProgressFilterUrl('/tasks', updateFilterParam(filters, { projectId: undefined })) },
          { key: 'status', label: `状態: ${filters.status}`, active: Boolean(filters.status), href: buildProgressFilterUrl('/tasks', updateFilterParam(filters, { status: undefined })) },
          { key: 'q', label: `検索: ${filters.q}`, active: Boolean(filters.q), href: buildProgressFilterUrl('/tasks', updateFilterParam(filters, { q: undefined })) },
        ]}
      />

      <GoalTodoAddForm goals={goalOptions} />

      {allTasks.length === 0 ? (
        <section className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700">
          条件に一致するToDoはありません。<Link href="/tasks" className="ml-2 font-bold text-blue-600 dark:text-blue-300">クリア</Link>
        </section>
      ) : (
        <TodoManager tasks={allTasks} projects={projects} queuedTaskIds={queuedTaskIds} />
      )}
    </div>
  )
}
