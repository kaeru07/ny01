import type { Approval, Epic, EpicPriority, EpicRiskFlag } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'
import type { QueueControl, WorkItemStatus } from '@/types/auto-queue'

const DANGER_RISK_FLAGS = new Set<EpicRiskFlag>([
  'billing',
  'production_db',
  'auth_secret',
  'migration',
  'destructive',
  'external_publish',
])

const PRIORITY_SCORE: Record<EpicPriority, number> = { P0: 900, P1: 600, P2: 300 }
const GOAL_PRIORITY_BOOST: Record<string, 0 | 1 | 2> = { high: 2, medium: 1, low: 0 }

export interface StatusContext {
  runs: ExecutionRun[]
  approvals: Approval[]
}

export interface QueueScoreInput {
  priority?: EpicPriority
  queueControl?: QueueControl
  lastRunAt?: string
  nextAction?: string
  updatedAt?: string
  factoryEligible?: boolean
}

export interface QueueScoreResult {
  queueScore: number
  reasonFactors: string[]
}

export function normalizePriority(priority?: EpicPriority): EpicPriority {
  return priority === 'P0' || priority === 'P1' || priority === 'P2' ? priority : 'P2'
}

export function hasDangerRisk(riskFlags?: EpicRiskFlag[]): boolean {
  return (riskFlags ?? []).some((flag) => DANGER_RISK_FLAGS.has(flag))
}

export function latestRunForEpic(epic: Pick<Epic, 'epicId' | 'latestRunId' | 'targetApp' | 'targetApps'>, runs: ExecutionRun[]): ExecutionRun | undefined {
  const targetApps = new Set([epic.targetApp, ...(epic.targetApps ?? [])].filter(Boolean).map((v) => String(v).toLowerCase()))
  const matches = runs.filter((run) => {
    if (run.epicId === epic.epicId) return true
    if (epic.latestRunId && run.runId === epic.latestRunId) return true
    return targetApps.size > 0 && targetApps.has(run.targetApp.toLowerCase())
  })
  return matches.sort((a, b) => Date.parse(b.finishedAt || b.startedAt) - Date.parse(a.finishedAt || a.startedAt))[0]
}

export function deriveWorkItemStatus(epic: Epic, context: StatusContext): WorkItemStatus {
  if (epic.status === 'done' || epic.status === 'merged') return 'done'
  if (epic.decisionPolicy === 'manual' || epic.factoryEligible === false) return 'manual'
  if ((epic.blockers ?? []).length > 0 || epic.status === 'blocked') return 'blocked'

  const pendingApproval = context.approvals.some((approval) => approval.epicId === epic.epicId && approval.status === 'pending')
  const dangerous = hasDangerRisk(epic.riskFlags)
  if (pendingApproval || dangerous || epic.decisionPolicy === 'approval_required') return 'waiting_user'

  const latestRun = latestRunForEpic(epic, context.runs)
  if (latestRun?.reviewStatus === 'needs_human') return 'waiting_user'
  if ((latestRun?.reviewStatus === 'not_reviewed' || latestRun?.reviewStatus === 'copied') && latestRun.runStatus !== 'failed') {
    const priority = normalizePriority(epic.priority)
    if (priority === 'P0' || priority === 'P1' || dangerous) return 'waiting_user'
    return 'review_waiting'
  }
  if (latestRun?.runStatus === 'failed') return 'blocked'

  if (epic.queueControl?.hold === true || epic.status === 'paused') return 'ai_hold'
  if (epic.factoryEligible === true) return 'executable'
  return 'manual'
}

function freshnessScore(input: QueueScoreInput, factors: string[]): number {
  if (input.nextAction && input.nextAction.trim()) {
    factors.push('nextActionあり')
    return 50
  }
  const base = input.lastRunAt ?? input.updatedAt
  if (!base) return 0
  const ageMs = Date.now() - Date.parse(base)
  if (!Number.isFinite(ageMs)) return 0
  if (ageMs >= 7 * 86_400_000) {
    factors.push('7日以上停滞')
    return -40
  }
  return 0
}

export function computeQueueScore(input: QueueScoreInput, goal?: Goal): QueueScoreResult {
  const priority = normalizePriority(input.priority)
  const factors: string[] = []
  let score = 0

  if (input.queueControl?.pinnedTop) {
    score += 100_000
    factors.push('明示pin')
  }
  if (goal?.pinnedTop) {
    score += 400
    factors.push(`Goal「${goal.title}」最優先`)
  }

  score += PRIORITY_SCORE[priority]
  factors.push(priority)

  const boost = goal?.priorityBoost ?? GOAL_PRIORITY_BOOST[goal?.priority ?? ''] ?? 0
  if (boost > 0) {
    score += boost * 150
    factors.push(`Goal boost+${boost}`)
  }

  score += freshnessScore(input, factors)

  if (input.factoryEligible === true) factors.push('factoryEligible')
  return { queueScore: score, reasonFactors: factors }
}
