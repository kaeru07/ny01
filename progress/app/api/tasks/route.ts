import { NextRequest, NextResponse } from 'next/server'
import { addTask, addTasks } from '@/lib/progress-writer'
import type { ExecutorType, NewTaskInput, TaskStatus, TaskPriority, TaskAssignee } from '@/types/progress'

const validStatuses: TaskStatus[] = ['pending_approval', 'backlog', 'todo', 'in_progress', 'impl_done', 'local_done', 'done', 'blocked', 'deleted', 'skipped']
const validPriorities: TaskPriority[] = ['high', 'medium', 'low']
const validAssignees: TaskAssignee[] = ['claude', 'user', 'both']
const validExecutors: ExecutorType[] = ['claude', 'codex', 'manual', 'other']

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return items.length > 0 ? items.map((item) => item.trim()) : undefined
}

function normalizeTask(body: Record<string, unknown>, fallbackProjectId?: string): NewTaskInput | null {
  const projectId = typeof body.projectId === 'string' && body.projectId.trim()
    ? body.projectId.trim()
    : fallbackProjectId
  const title = typeof body.title === 'string' ? body.title.trim() : ''

  if (!projectId || !title) return null

  return {
    projectId,
    title,
    status: validStatuses.includes(body.status as TaskStatus) ? body.status as TaskStatus : 'todo',
    priority: validPriorities.includes(body.priority as TaskPriority) ? body.priority as TaskPriority : 'medium',
    assignee: validAssignees.includes(body.assignee as TaskAssignee) ? body.assignee as TaskAssignee : 'claude',
    preferredExecutor: validExecutors.includes(body.preferredExecutor as ExecutorType) ? body.preferredExecutor as ExecutorType : undefined,
    fallbackExecutor: validExecutors.includes(body.fallbackExecutor as ExecutorType) ? body.fallbackExecutor as ExecutorType : undefined,
    autoFallback: typeof body.autoFallback === 'boolean' ? body.autoFallback : undefined,
    canRunOnCodex: typeof body.canRunOnCodex === 'boolean' ? body.canRunOnCodex : undefined,
    requiresClaude: typeof body.requiresClaude === 'boolean' ? body.requiresClaude : undefined,
    memo: typeof body.memo === 'string' ? body.memo.trim() : '',
    taskPrompt: typeof body.taskPrompt === 'string' ? body.taskPrompt.trim() : undefined,
    doneCriteria: asStringArray(body.doneCriteria),
    allowed: asStringArray(body.allowed),
    forbidden: asStringArray(body.forbidden),
    risk: typeof body.risk === 'string' ? body.risk.trim() : undefined,
    blockedReason: typeof body.blockedReason === 'string' ? body.blockedReason.trim() : undefined,
    unblockAction: typeof body.unblockAction === 'string' ? body.unblockAction.trim() : undefined,
    nextQuestion: typeof body.nextQuestion === 'string' ? body.nextQuestion.trim() : undefined,
    targetPath: typeof body.targetPath === 'string' ? body.targetPath.trim() : undefined,
    targetApp: typeof body.targetApp === 'string' ? body.targetApp.trim() : undefined,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, title } = body

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    if (Array.isArray(body.tasks)) {
      const inputs = body.tasks
        .filter((task: unknown): task is Record<string, unknown> => typeof task === 'object' && task !== null && !Array.isArray(task))
        .map((task: Record<string, unknown>) => normalizeTask(task, projectId))
        .filter((task: NewTaskInput | null): task is NewTaskInput => task !== null)

      if (inputs.length === 0) {
        return NextResponse.json({ error: 'tasks must contain at least one valid task' }, { status: 400 })
      }

      const taskIds = await addTasks(inputs)
      return NextResponse.json({ success: true, taskIds, count: taskIds.length })
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const input = normalizeTask(body)
    if (!input) return NextResponse.json({ error: 'invalid task' }, { status: 400 })

    const taskId = await addTask(input)
    return NextResponse.json({ success: true, taskId })
  } catch (err) {
    console.error('Failed to add task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
