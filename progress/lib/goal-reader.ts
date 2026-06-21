import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import type { Goal, GoalsData, GoalProgress, GoalRoleCounts, GoalStatus } from '@/types/goal'

const EMPTY: GoalsData = { goals: [], mainGoalId: undefined, updatedAt: '' }
const VALID_STATUSES: GoalStatus[] = ['proposed', 'active', 'paused', 'done', 'dropped', 'archived']

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function normalizeGoal(raw: Partial<Goal> & Record<string, unknown>): Goal {
  const now = new Date().toISOString()
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : 'Untitled Goal'
  const summary = typeof raw.summary === 'string' ? raw.summary : typeof raw.description === 'string' ? raw.description : ''
  const status = VALID_STATUSES.includes(raw.status as GoalStatus) ? (raw.status as GoalStatus) : 'active'
  return {
    id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `goal-${Date.now()}`,
    projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
    title,
    description: typeof raw.description === 'string' ? raw.description : summary,
    metric: typeof raw.metric === 'string' ? raw.metric : 'progress',
    target: normalizeNumber(raw.target, 100),
    current: normalizeNumber(raw.current, typeof raw.target === 'number' ? 0 : 0),
    metricSyncedAt: typeof raw.metricSyncedAt === 'string' ? raw.metricSyncedAt : undefined,
    isNorthStar: raw.isNorthStar === true,
    summary,
    decisionPolicyDefault: typeof raw.decisionPolicyDefault === 'string' ? raw.decisionPolicyDefault as Goal['decisionPolicyDefault'] : undefined,
    riskFlagsDefault: Array.isArray(raw.riskFlagsDefault) ? raw.riskFlagsDefault as Goal['riskFlagsDefault'] : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    status,
    priority: raw.priority === 'high' || raw.priority === 'low' || raw.priority === 'medium' ? raw.priority : 'medium',
    priorityBoost: raw.priorityBoost === 0 || raw.priorityBoost === 1 || raw.priorityBoost === 2 ? raw.priorityBoost : undefined,
    pinnedTop: raw.pinnedTop === true,
    queueControl: raw.queueControl && typeof raw.queueControl === 'object' ? raw.queueControl as Goal['queueControl'] : undefined,
    lastSelectedRunId: typeof raw.lastSelectedRunId === 'string' ? raw.lastSelectedRunId : undefined,
    lastSelectedAt: typeof raw.lastSelectedAt === 'string' ? raw.lastSelectedAt : undefined,
    autonomyNotifiedAt: typeof raw.autonomyNotifiedAt === 'string' ? raw.autonomyNotifiedAt : undefined,
    autonomyNotifyNoopAt: typeof raw.autonomyNotifyNoopAt === 'string' ? raw.autonomyNotifyNoopAt : undefined,
    autonomyNotifyAttempts: normalizeNumber(raw.autonomyNotifyAttempts, 0),
    monetizationImpact: raw.monetizationImpact === 'high' || raw.monetizationImpact === 'medium' || raw.monetizationImpact === 'low' || raw.monetizationImpact === 'none' ? raw.monetizationImpact : 'none',
    // 提案(proposed)系フィールドは保持必須。落とすと readGoals→writeGoals のたびに提案元・承認カテゴリが消える。
    proposalSource: typeof raw.proposalSource === 'string' ? raw.proposalSource : undefined,
    proposedAt: typeof raw.proposedAt === 'string' ? raw.proposedAt : undefined,
    approvedAt: typeof raw.approvedAt === 'string' ? raw.approvedAt : undefined,
    proposalEnables: typeof raw.proposalEnables === 'string' ? raw.proposalEnables : undefined,
    proposalPros: Array.isArray(raw.proposalPros) ? raw.proposalPros.filter((p): p is string => typeof p === 'string') : undefined,
    proposalCons: Array.isArray(raw.proposalCons) ? raw.proposalCons.filter((c): c is string => typeof c === 'string') : undefined,
    phases: Array.isArray(raw.phases) ? raw.phases : [],
    todos: Array.isArray(raw.todos) ? raw.todos : [],
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  }
}

export async function readGoals(): Promise<GoalsData> {
  try {
    const filePath = path.join(getDataPath(), 'goals.json')
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<GoalsData>
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals.map((g) => normalizeGoal(g as Partial<Goal> & Record<string, unknown>)) : [],
      mainGoalId: typeof parsed.mainGoalId === 'string' ? parsed.mainGoalId : undefined,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    }
  } catch {
    return { ...EMPTY }
  }
}

const GOAL_PRIORITY_NUM: Record<string, number> = { high: 2, medium: 1, low: 0 }

/**
 * Goal を表示・実行で共通の優先順に並べ、goalId → 順位（0 が最優先）の Map を返す。
 * 規則: pinnedTop > priorityBoost > priority(high>med>low) > goals.json 内の並び順（安定）。
 * 自動実行キューの並びと Factory の次回実行選択は、この順位を第一キーとして共有する。
 */
export function rankGoals(goals: Goal[]): Map<string, number> {
  const ordered = goals
    .map((goal, idx) => ({ goal, idx }))
    .sort((a, b) => {
      const ap = a.goal.pinnedTop === true ? 1 : 0
      const bp = b.goal.pinnedTop === true ? 1 : 0
      if (ap !== bp) return bp - ap
      const ab = a.goal.priorityBoost ?? 0
      const bb = b.goal.priorityBoost ?? 0
      if (ab !== bb) return bb - ab
      const apr = GOAL_PRIORITY_NUM[a.goal.priority] ?? 1
      const bpr = GOAL_PRIORITY_NUM[b.goal.priority] ?? 1
      if (apr !== bpr) return bpr - apr
      return a.idx - b.idx
    })
  return new Map(ordered.map((entry, rank) => [entry.goal.id, rank]))
}

/** goalId の順位を返す。未設定・未知の Goal は末尾（MAX）に寄せる。 */
export function goalRankOf(rank: Map<string, number>, goalId?: string): number {
  if (!goalId) return Number.MAX_SAFE_INTEGER
  return rank.get(goalId) ?? Number.MAX_SAFE_INTEGER
}

export function findNorthStarGoal(data: GoalsData): Goal | undefined {
  return data.goals.find((g) => g.isNorthStar && g.status === 'active')
    ?? data.goals.find((g) => g.isNorthStar)
}

export function goalAchievement(goal: Goal): number {
  if (typeof goal.target === 'number' && goal.target > 0) {
    return Math.max(0, Math.min(100, Math.round(((goal.current ?? 0) / goal.target) * 100)))
  }
  return calcGoalProgress(goal).ratio
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
