import type { Approval, Epic, EpicPriority, EpicRiskFlag } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'
import type { QueueControl, QueueResolution, WorkItemStatus } from '@/types/auto-queue'

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
  if (epic.queueControl?.hold === true || epic.status === 'paused') return 'ai_hold'

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

/** 候補外アイテムの「どうすれば自動実行候補に入るか」を返す。executable/done は解消不要で undefined。 */
export function deriveResolution(
  epic: Pick<Epic, 'epicId' | 'blockers' | 'factoryEligible' | 'decisionPolicy' | 'riskFlags' | 'queueControl'>,
  status: WorkItemStatus,
  latestRun: ExecutionRun | undefined,
  hasPendingApproval: boolean,
): QueueResolution | undefined {
  switch (status) {
    case 'executable':
    case 'done':
      return undefined
    case 'review_waiting':
      return {
        how: 'Inboxのレビュータブで、この作業の最新の結果を「問題なし」にすると、次回の自動実行候補に入ります。',
        actionLabel: 'Inboxでレビューする',
        actionHref: '/decide',
      }
    case 'waiting_user': {
      if (hasPendingApproval || hasDangerRisk(epic.riskFlags) || epic.decisionPolicy === 'approval_required') {
        return {
          how: '危険を伴う作業のため承認が必要です。Inboxの「今日の判断」で承認すると、AIが自動実行できます。',
          actionLabel: 'Inboxで承認する',
          actionHref: '/decide',
        }
      }
      if (latestRun?.reviewStatus === 'needs_human') {
        return {
          how: 'AIだけでは判断できなかった作業です。Inboxの「今日の判断」であなたの判断を入力すると、次に進めます。',
          actionLabel: 'Inboxで判断する',
          actionHref: '/decide',
        }
      }
      return {
        how: '重要度が高い作業です。Inboxのレビュータブで最新の結果を「問題なし」にすると、次回の自動実行候補に入ります。',
        actionLabel: 'Inboxでレビューする',
        actionHref: '/decide',
      }
    }
    case 'blocked': {
      const blocker = (epic.blockers ?? [])[0]
      return {
        how: blocker
          ? `ブロック要因（${blocker}）を解消すると、次回の自動実行候補に入ります。`
          : '前回の作業が失敗しています。原因を直すと、次回の自動実行候補に入ります。',
        actionLabel: '詳細を見る',
        actionHref: `/epic/${epic.epicId}`,
      }
    }
    case 'ai_hold':
      if (epic.queueControl?.hold === true) {
        return {
          how: 'あなたが「保留」にした作業です。下の「保留解除」で自動実行候補に戻せます（安全条件は引き続き確認します）。',
          actionLabel: '保留解除',
          actionHref: '/queue',
        }
      }
      return {
        how: 'AIが一時保留にしています（依存作業の完了待ちなど）。条件が解ければ自動で候補に戻ります。',
      }
    case 'manual':
      if (epic.factoryEligible === false) {
        return {
          how: '自動実行の対象から外れています。下の「対象に戻す」で次回候補に含められます。',
          actionLabel: '対象に戻す',
          actionHref: '/queue',
        }
      }
      if (epic.decisionPolicy === 'manual') {
        return {
          how: '手動対応の作業として設定されています（自動実行の対象外）。自動化するには作業の方針設定（decisionPolicy）の見直しが必要です。',
        }
      }
      return {
        how: 'この作業はまだ自動実行の対象に設定されていません。下の「対象にする」で次回候補に含められます。',
        actionLabel: '対象にする',
        actionHref: '/queue',
      }
    default:
      return undefined
  }
}
