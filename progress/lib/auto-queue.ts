import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals } from '@/lib/goal-reader'
import { listInboxItems } from '@/lib/inbox-reader'
import { computeQueueScore, deriveResolution, deriveWorkItemStatus, latestRunForEpic, normalizePriority } from '@/lib/auto-queue-score'
import type { Approval, Epic } from '@/lib/types/operations'
import type { AutoQueueCounts, AutoQueueItem, AutoQueueView, GoalProgressRow, WorkItemStatus } from '@/types/auto-queue'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal, GoalTodo } from '@/types/goal'

const CLOSED_EPIC_STATUSES = new Set(['done', 'merged', 'dropped', 'split'])
const PRIORITY_RANK = { P0: 0, P1: 1, P2: 2 }

function runAt(run?: ExecutionRun): string | undefined {
  return run?.finishedAt || run?.startedAt || undefined
}

function doneCriteriaDone(epic: Epic, total: number): number {
  if (total <= 0) return 0
  if (epic.status === 'done' || epic.status === 'merged') return total
  const byProgress = Math.floor((Math.max(0, Math.min(100, epic.progress ?? 0)) / 100) * total)
  const byRemaining = total - (epic.remainingWork?.length ?? total)
  return Math.max(0, Math.min(total, Math.max(byProgress, byRemaining)))
}

export function statusBlockedReason(status: WorkItemStatus): string {
  const statusLabel: Record<WorkItemStatus, string> = {
    executable: '実行可能',
    waiting_user: '人間判断待ち',
    ai_hold: 'AI保留中',
    review_waiting: 'レビュー待ち',
    blocked: 'ブロック中',
    manual: '手動または対象外',
    done: '完了済み',
  }
  return statusLabel[status]
}

function reasonFromFactors(status: WorkItemStatus, factors: string[], goalTitle: string | undefined, pinnedTop: boolean): string {
  if (status !== 'executable') {
    const blockedReason = statusBlockedReason(status)
    if (pinnedTop) return `最優先指定中。ただし${blockedReason}のため、次回自動実行候補には入りません`
    return `${blockedReason}のため、次回自動実行候補には入りません`
  }
  const core = factors.filter((f) => f !== 'factoryEligible')
  if (core.length === 0) return '実行可能条件を満たしているため候補入り'
  const suffix = goalTitle ? ` / Goal「${goalTitle}」配下` : ''
  return `${core.slice(0, 4).join('＋')} のため上位候補${suffix}`
}

function toEpicItem(epic: Epic, goal: Goal | undefined, runs: ExecutionRun[], status: WorkItemStatus, approvals: Approval[]): AutoQueueItem {
  const latestRun = latestRunForEpic(epic, runs)
  const lastRunAt = runAt(latestRun)
  const hasPendingApproval = approvals.some((a) => a.epicId === epic.epicId && a.status === 'pending')
  const score = computeQueueScore({
    priority: epic.priority,
    queueControl: epic.queueControl,
    lastRunAt,
    nextAction: epic.nextAction,
    updatedAt: epic.updatedAt,
    factoryEligible: epic.factoryEligible,
  }, goal)
  const total = epic.doneCriteria?.length ?? 0
  const candidateEligible = epic.factoryEligible === true && status === 'executable'
  return {
    workItemId: `epic:${epic.epicId}`,
    type: 'epic',
    sourceId: epic.epicId,
    title: epic.title,
    goalId: epic.goalId,
    goalTitle: goal?.title ?? epic.goal,
    projectId: goal?.projectId ?? epic.targetApp ?? epic.targetApps?.[0],
    projectName: goal?.projectId ?? epic.targetApp ?? epic.targetApps?.[0],
    status,
    priority: normalizePriority(epic.priority),
    factoryEligible: epic.factoryEligible === true,
    decisionPolicy: epic.decisionPolicy,
    preferredExecutor: epic.preferredExecutor,
    fallbackExecutor: epic.fallbackExecutor,
    doneCriteriaTotal: total,
    doneCriteriaDone: doneCriteriaDone(epic, total),
    blockers: epic.blockers ?? [],
    latestRunId: latestRun?.runId,
    lastRunAt,
    updatedAt: epic.updatedAt,
    queueScore: score.queueScore,
    queueOrder: 0,
    candidateEligible,
    candidateBlockedReason: candidateEligible ? undefined : statusBlockedReason(status),
    resolution: candidateEligible ? undefined : deriveResolution(epic, status, latestRun, hasPendingApproval),
    reason: reasonFromFactors(status, score.reasonFactors, goal?.title, epic.queueControl?.pinnedTop === true),
    reasonFactors: score.reasonFactors.length > 0 ? score.reasonFactors : [status],
    queueControl: epic.queueControl,
  }
}

function todoPriority(todo: GoalTodo): 'P0' | 'P1' | 'P2' {
  if (todo.priority === 'high') return 'P0'
  if (todo.priority === 'medium') return 'P1'
  return 'P2'
}

function toGoalTodoItem(todo: GoalTodo, goal: Goal): AutoQueueItem {
  const priority = todoPriority(todo)
  const status: WorkItemStatus = todo.status === 'done' || todo.status === 'skipped'
    ? 'done'
    : todo.dependsOn.length > 0
      ? 'ai_hold'
      : 'executable'
  const score = computeQueueScore({
    priority,
    nextAction: todo.nextAction,
    updatedAt: todo.updatedAt,
    factoryEligible: status === 'executable',
  }, goal)
  const candidateEligible = status === 'executable'
  return {
    workItemId: `todo:${todo.id}`,
    type: 'goal_todo',
    sourceId: todo.id,
    title: todo.title,
    goalId: goal.id,
    goalTitle: goal.title,
    projectId: goal.projectId,
    projectName: goal.projectId,
    status,
    priority,
    factoryEligible: status === 'executable',
    decisionPolicy: 'autonomous',
    preferredExecutor: todo.role === 'codex' ? 'codex' : 'claude',
    doneCriteriaTotal: todo.doneCriteria.length,
    doneCriteriaDone: todo.status === 'done' ? todo.doneCriteria.length : 0,
    blockers: [],
    updatedAt: todo.updatedAt,
    queueScore: score.queueScore,
    queueOrder: 0,
    candidateEligible,
    candidateBlockedReason: candidateEligible ? undefined : statusBlockedReason(status),
    resolution: candidateEligible
      ? undefined
      : { how: '依存する作業の完了待ちです。先行する作業が終わると自動で候補に戻ります。' },
    reason: reasonFromFactors(status, score.reasonFactors, goal.title, false),
    reasonFactors: score.reasonFactors.length > 0 ? score.reasonFactors : [status],
  }
}

function compareItems(a: AutoQueueItem, b: AutoQueueItem): number {
  const ap = a.queueControl?.pinnedTop === true
  const bp = b.queueControl?.pinnedTop === true
  if (ap !== bp) return ap ? -1 : 1
  const am = a.queueControl?.manualOrder
  const bm = b.queueControl?.manualOrder
  if (typeof am === 'number' && typeof bm === 'number' && am !== bm) return am - bm
  if (a.queueScore !== b.queueScore) return b.queueScore - a.queueScore
  if (typeof am === 'number' && typeof bm !== 'number') return -1
  if (typeof bm === 'number' && typeof am !== 'number') return 1
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  if (pr !== 0) return pr
  const at = Date.parse(a.lastRunAt ?? a.updatedAt ?? '')
  const bt = Date.parse(b.lastRunAt ?? b.updatedAt ?? '')
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return bt - at
  return a.workItemId.localeCompare(b.workItemId)
}

function countsOf(items: AutoQueueItem[], inbox: number): AutoQueueCounts {
  const counts: AutoQueueCounts = {
    executable: 0,
    waiting_user: 0,
    ai_hold: 0,
    review_waiting: 0,
    blocked: 0,
    manual: 0,
    done: 0,
    inbox,
  }
  for (const item of items) counts[item.status] += 1
  return counts
}

function buildGoalProgress(goals: Goal[], items: AutoQueueItem[]): GoalProgressRow[] {
  return goals.map((goal) => {
    const goalItems = items.filter((item) => item.goalId === goal.id)
    const todoTotal = goal.todos.length
    const todoDone = goal.todos.filter((todo) => todo.status === 'done' || todo.status === 'skipped').length
    const itemTotal = goalItems.length
    const itemDone = goalItems.filter((item) => item.status === 'done').length
    const total = Math.max(todoTotal, itemTotal)
    const done = Math.max(todoDone, itemDone)
    const latest = goalItems
      .map((item) => item.lastRunAt ?? item.updatedAt)
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
    return {
      goalId: goal.id,
      title: goal.title,
      projectId: goal.projectId,
      total,
      done,
      ratio: total === 0 ? 0 : Math.round((done / total) * 100),
      executable: goalItems.filter((item) => item.status === 'executable').length,
      waitingUser: goalItems.filter((item) => item.status === 'waiting_user').length,
      aiHold: goalItems.filter((item) => item.status === 'ai_hold').length,
      reviewWaiting: goalItems.filter((item) => item.status === 'review_waiting').length,
      blocked: goalItems.filter((item) => item.status === 'blocked').length,
      lastRunAt: latest,
      priorityBoost: goal.priorityBoost,
      pinnedTop: goal.pinnedTop,
    }
  }).filter((row) => row.total > 0 || row.executable > 0 || row.waitingUser > 0)
    .sort((a, b) => {
      if (a.pinnedTop !== b.pinnedTop) return a.pinnedTop ? -1 : 1
      if ((a.priorityBoost ?? 0) !== (b.priorityBoost ?? 0)) return (b.priorityBoost ?? 0) - (a.priorityBoost ?? 0)
      return b.executable - a.executable
    })
}

export async function buildAutoQueue(): Promise<AutoQueueView> {
  const [epics, goalsData, runs, approvals, inbox] = await Promise.all([
    getEpics(),
    readGoals(),
    readExecutionRuns(),
    getPendingApprovals(),
    listInboxItems().catch(() => []),
  ])
  const goals = goalsData.goals
  const goalById = new Map(goals.map((goal) => [goal.id, goal]))
  const epicTodoIds = new Set(epics.flatMap((epic) => epic.relatedTodoIds ?? []))

  const items: AutoQueueItem[] = []
  for (const epic of epics) {
    if (CLOSED_EPIC_STATUSES.has(epic.status)) continue
    const status = deriveWorkItemStatus(epic, { runs, approvals })
    items.push(toEpicItem(epic, epic.goalId ? goalById.get(epic.goalId) : undefined, runs, status, approvals))
  }

  for (const goal of goals) {
    if (goal.status !== 'active') continue
    for (const todo of goal.todos) {
      if (todo.role === 'human') continue
      if (epicTodoIds.has(todo.id)) continue
      if (todo.status === 'done' || todo.status === 'skipped') continue
      items.push(toGoalTodoItem(todo, goal))
    }
  }

  const executable = items
    .filter((item) => item.factoryEligible === true && item.status === 'executable')
    .sort(compareItems)
    .map((item, index) => ({ ...item, queueOrder: index + 1 }))

  const withExecutableOrder = new Map(executable.map((item) => [item.workItemId, item]))
  const merged = items.map((item) => withExecutableOrder.get(item.workItemId) ?? item)
  const pinnedExcluded = merged
    .filter((item) => item.queueControl?.pinnedTop === true && item.status !== 'executable')
    .sort(compareItems)

  return {
    next: executable[0] ?? null,
    candidates: executable.slice(1, 4),
    executable,
    waitingUser: merged.filter((item) => item.status === 'waiting_user').sort(compareItems),
    aiHold: merged.filter((item) => item.status === 'ai_hold').sort(compareItems),
    reviewWaiting: merged.filter((item) => item.status === 'review_waiting').sort(compareItems),
    blocked: merged.filter((item) => item.status === 'blocked').sort(compareItems),
    manual: merged.filter((item) => item.status === 'manual').sort(compareItems),
    pinnedExcluded,
    counts: countsOf(merged, inbox.filter((item) => !item.imported).length),
    goalProgress: buildGoalProgress(goals, merged),
    generatedAt: new Date().toISOString(),
  }
}

export const getAutoQueueView = buildAutoQueue
