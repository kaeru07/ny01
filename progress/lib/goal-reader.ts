import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import type { Goal, GoalsData, GoalProgress, GoalRoleCounts } from '@/types/goal'

const EMPTY: GoalsData = { goals: [], mainGoalId: undefined, updatedAt: '' }

export async function readGoals(): Promise<GoalsData> {
  try {
    const filePath = path.join(getDataPath(), 'goals.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<GoalsData>
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      mainGoalId: typeof parsed.mainGoalId === 'string' ? parsed.mainGoalId : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

export function findMainGoal(data: GoalsData): Goal | undefined {
  if (data.goals.length === 0) return undefined
  if (data.mainGoalId) {
    const found = data.goals.find((g) => g.id === data.mainGoalId)
    if (found) return found
  }
  const active = data.goals.find((g) => g.status === 'active')
  return active ?? data.goals[0]
}

const ZERO_ROLE_COUNTS: GoalRoleCounts = { human: 0, claude: 0, codex: 0 }

export function calcGoalProgress(goal: Goal): GoalProgress {
  const total = goal.todos.length
  const done = goal.todos.filter((t) => t.status === 'done').length
  const perRole: GoalRoleCounts = { ...ZERO_ROLE_COUNTS }
  const openPerRole: GoalRoleCounts = { ...ZERO_ROLE_COUNTS }
  for (const t of goal.todos) {
    perRole[t.role] += 1
    if (t.status !== 'done' && t.status !== 'skipped') openPerRole[t.role] += 1
  }
  return {
    totalTodos: total,
    doneTodos: done,
    ratio: total === 0 ? 0 : Math.round((done / total) * 100),
    perRole,
    openPerRole,
  }
}

export function nextTodosByRole(goal: Goal): { human: typeof goal.todos[number] | null; claude: typeof goal.todos[number] | null; codex: typeof goal.todos[number] | null } {
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const open = goal.todos.filter((t) => t.status !== 'done' && t.status !== 'skipped')
  const sorted = [...open].sort((a, b) => {
    const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
    if (p !== 0) return p
    return a.order - b.order
  })
  return {
    human: sorted.find((t) => t.role === 'human') ?? null,
    claude: sorted.find((t) => t.role === 'claude') ?? null,
    codex: sorted.find((t) => t.role === 'codex') ?? null,
  }
}

export function calcPhaseProgress(goal: Goal): Array<{ phaseId: string; title: string; order: number; status: string; total: number; done: number; ratio: number }> {
  return goal.phases
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((phase) => {
      const todos = goal.todos.filter((t) => t.phaseId === phase.id)
      const done = todos.filter((t) => t.status === 'done').length
      const total = todos.length
      return {
        phaseId: phase.id,
        title: phase.title,
        order: phase.order,
        status: phase.status,
        total,
        done,
        ratio: total === 0 ? 0 : Math.round((done / total) * 100),
      }
    })
}
