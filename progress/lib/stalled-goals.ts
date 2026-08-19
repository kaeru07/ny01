import type { Goal, GoalTodo } from '@/types/goal'

export const STALL_WARN_DAYS = 7
export const STALL_DAYS = 14

const DAY_MS = 86_400_000

export interface StalledGoal {
  goal: Goal
  severity: 'stalled' | 'warn'
  ageDays: number
  stalledDays: number
  cause: string
  resolution: string
  prospect: 'likely' | 'needs_decision' | 'unlikely'
}

function parseTime(value?: string): number | undefined {
  if (!value) return undefined
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : undefined
}

function maxTime(values: Array<string | undefined>): number | undefined {
  const times = values.map(parseTime).filter((time): time is number => time !== undefined)
  if (times.length === 0) return undefined
  return Math.max(...times)
}

function lastProgressTime(goal: Goal): number | undefined {
  const latestTodoTime = maxTime(goal.todos.map((todo) => todo.updatedAt))
  return maxTime([
    goal.lastSelectedAt,
    latestTodoTime ? new Date(latestTodoTime).toISOString() : undefined,
    goal.approvedAt,
    goal.createdAt,
  ])
}

function hasDependencyOrBlocker(goal: Goal): boolean {
  const rawBlockers = (goal as unknown as { blockers?: unknown }).blockers
  const hasGoalBlocker = Array.isArray(rawBlockers) && rawBlockers.some((item) => typeof item === 'string' && item.trim())
  const hasTodoDependency = goal.todos.some((todo) => Array.isArray(todo.dependsOn) && todo.dependsOn.length > 0)
  return hasGoalBlocker || hasTodoDependency
}

function hasOldDependency(goal: Goal, now: number): boolean {
  const dependentTodos = goal.todos.filter((todo) => Array.isArray(todo.dependsOn) && todo.dependsOn.length > 0)
  if (dependentTodos.length === 0) return false
  return dependentTodos.every((todo) => {
    const updated = parseTime(todo.updatedAt)
    return updated !== undefined && (now - updated) / DAY_MS >= STALL_DAYS
  })
}

function allTodosClosed(todos: GoalTodo[]): boolean {
  return todos.length > 0 && todos.every((todo) => todo.status === 'done' || todo.status === 'skipped')
}

function diagnose(goal: Goal, stalledDays: number, now: number): Pick<StalledGoal, 'cause' | 'resolution' | 'prospect'> {
  if (goal.todos.length === 0) {
    return {
      cause: '自動実行できるタスクが無い（承認されたがタスク分解／Epic生成がされていない）',
      resolution: 'タスクに分解する、またはこのゴールを保留にしてキューから外す',
      prospect: 'needs_decision',
    }
  }

  if (allTodosClosed(goal.todos)) {
    return {
      cause: '実質完了。statusがactiveのまま（done化漏れ）',
      resolution: '完了にする（1クリック）',
      prospect: 'likely',
    }
  }

  if (hasDependencyOrBlocker(goal)) {
    return {
      cause: '依存・ブロッカー待ち',
      resolution: '先行作業の完了を待つ。動いていなければ保留',
      prospect: hasOldDependency(goal, now) ? 'unlikely' : 'needs_decision',
    }
  }

  if (!goal.lastSelectedAt || stalledDays >= STALL_DAYS) {
    return {
      cause: `キュー内で優先度が低く、他ゴールに負け続けている（優先度=${goal.priority}／手動順=${goal.queueControl?.manualOrder ?? '-'}）`,
      resolution: '優先度／表示順を上げて先に処理させる、または保留にする',
      prospect: 'needs_decision',
    }
  }

  return {
    cause: '長期間キューに滞留（原因は要確認）',
    resolution: '優先度、依存、完了条件を確認し、不要なら保留にする',
    prospect: 'needs_decision',
  }
}

export function computeStalledGoals(goals: Goal[], now = Date.now()): StalledGoal[] {
  return goals
    .filter((goal) => goal.status === 'active')
    .map((goal): StalledGoal | null => {
      const approvedOrCreated = parseTime(goal.approvedAt ?? goal.createdAt)
      const progressTime = lastProgressTime(goal)
      if (approvedOrCreated === undefined || progressTime === undefined) return null

      const ageDays = (now - approvedOrCreated) / DAY_MS
      const stalledDays = (now - progressTime) / DAY_MS
      const neverSelectedStalled = !goal.lastSelectedAt && ageDays >= STALL_DAYS
      const severity =
        stalledDays >= STALL_DAYS || neverSelectedStalled
          ? 'stalled'
          : stalledDays >= STALL_WARN_DAYS
            ? 'warn'
            : null
      if (!severity) return null

      return {
        goal,
        severity,
        ageDays,
        stalledDays,
        ...diagnose(goal, stalledDays, now),
      }
    })
    .filter((item): item is StalledGoal => item !== null)
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'stalled' ? -1 : 1
      return b.stalledDays - a.stalledDays
    })
}
