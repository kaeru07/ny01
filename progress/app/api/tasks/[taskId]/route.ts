import { NextRequest, NextResponse } from 'next/server'
import { updateTask, updateTaskStatus, updateTaskPrompt } from '@/lib/progress-writer'
import type { ExecutorType, TaskStatus, TaskAssignee, TaskPriority } from '@/types/progress'

interface Params {
  params: { taskId: string }
}

const VALID_SOURCE_TYPES = ['user', 'ai_generated', 'execution_review', 'market_research', 'vault', 'github_issue'] as const

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { taskId } = params
    const body = await request.json()
    const {
      projectId, status, nextAction, assignee, taskPrompt, title, priority, memo, fullUpdate,
      doneCriteria, allowed, forbidden, risk, blockedReason, unblockAction, nextQuestion, targetPath, targetApp,
      preferredExecutor, fallbackExecutor, autoFallback, canRunOnCodex, requiresClaude,
      source, sourceRunId, sourceType, goalId, phaseId,
    } = body

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // full update path (編集フォームから)
    if (fullUpdate === true) {
      const validStatuses: TaskStatus[] = ['pending_approval', 'backlog', 'todo', 'in_progress', 'impl_done', 'local_done', 'done', 'blocked', 'deleted', 'skipped']
      const validAssignees: TaskAssignee[] = ['claude', 'user', 'both']
      const validPriorities: TaskPriority[] = ['high', 'medium', 'low']
      const validExecutors: ExecutorType[] = ['claude', 'codex', 'manual', 'other']
      const updates: Parameters<typeof updateTask>[2] = {}
      if (typeof goalId === 'string') updates.goalId = goalId.trim()
      if (typeof phaseId === 'string') updates.phaseId = phaseId.trim()
      if (typeof title === 'string' && title.trim()) updates.title = title.trim()
      if (typeof status === 'string' && validStatuses.includes(status as TaskStatus)) updates.status = status as TaskStatus
      if (typeof priority === 'string' && validPriorities.includes(priority as TaskPriority)) updates.priority = priority as TaskPriority
      if (typeof assignee === 'string' && validAssignees.includes(assignee as TaskAssignee)) updates.assignee = assignee as TaskAssignee
      if (typeof memo === 'string') updates.memo = memo
      if (typeof taskPrompt === 'string') updates.taskPrompt = taskPrompt
      if (Array.isArray(doneCriteria)) updates.doneCriteria = doneCriteria.map(String).filter(Boolean)
      if (Array.isArray(allowed)) updates.allowed = allowed.map(String).filter(Boolean)
      if (Array.isArray(forbidden)) updates.forbidden = forbidden.map(String).filter(Boolean)
      if (typeof risk === 'string') updates.risk = risk
      if (typeof blockedReason === 'string') updates.blockedReason = blockedReason
      if (typeof unblockAction === 'string') updates.unblockAction = unblockAction
      if (typeof nextQuestion === 'string') updates.nextQuestion = nextQuestion
      if (typeof targetPath === 'string') updates.targetPath = targetPath
      if (typeof targetApp === 'string') updates.targetApp = targetApp
      if (typeof preferredExecutor === 'string' && validExecutors.includes(preferredExecutor as ExecutorType)) updates.preferredExecutor = preferredExecutor as ExecutorType
      if (typeof fallbackExecutor === 'string' && validExecutors.includes(fallbackExecutor as ExecutorType)) updates.fallbackExecutor = fallbackExecutor as ExecutorType
      if (typeof autoFallback === 'boolean') updates.autoFallback = autoFallback
      if (typeof canRunOnCodex === 'boolean') updates.canRunOnCodex = canRunOnCodex
      if (typeof requiresClaude === 'boolean') updates.requiresClaude = requiresClaude
      if (typeof source === 'string') updates.source = source
      if (typeof sourceRunId === 'string') updates.sourceRunId = sourceRunId
      if (typeof sourceType === 'string' && VALID_SOURCE_TYPES.includes(sourceType as typeof VALID_SOURCE_TYPES[number])) {
        updates.sourceType = sourceType as typeof VALID_SOURCE_TYPES[number]
      }
      await updateTask(projectId, taskId, updates)
      return NextResponse.json({ success: true })
    }

    // taskPrompt update path (status 不要)
    if (typeof taskPrompt === 'string' && status === undefined) {
      await updateTaskPrompt(projectId, taskId, taskPrompt)
      return NextResponse.json({ success: true })
    }

    // status update path (既存)
    const validStatuses: TaskStatus[] = ['pending_approval', 'backlog', 'todo', 'in_progress', 'impl_done', 'local_done', 'done', 'blocked', 'deleted', 'skipped']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const validAssignees: TaskAssignee[] = ['claude', 'user', 'both']
    const options: { nextActionOverride?: string; assignee?: TaskAssignee } = {}
    if (typeof nextAction === 'string' && nextAction.trim()) options.nextActionOverride = nextAction.trim()
    if (typeof assignee === 'string' && validAssignees.includes(assignee as TaskAssignee)) {
      options.assignee = assignee as TaskAssignee
    }

    await updateTaskStatus(projectId, taskId, status as TaskStatus, options)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Failed to update task:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
