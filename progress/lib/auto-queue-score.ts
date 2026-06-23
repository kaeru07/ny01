import type { Approval, Epic, EpicPriority, EpicRiskFlag } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'
import type { QueueControl, QueueResolution, WorkItemStatus } from '@/types/auto-queue'
import { AUTONOMY_ANCHOR_SCORE_BOOST, REVIEW_FIX_SCORE_BOOST } from '@/lib/autonomy-anchor'
import { epicPriorityLabel } from '@/lib/epic-priority-label'

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
  fixRequested?: boolean
  autonomyAnchor?: boolean
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

export function dangerRiskFlags(riskFlags?: EpicRiskFlag[]): EpicRiskFlag[] {
  return (riskFlags ?? []).filter((flag) => DANGER_RISK_FLAGS.has(flag))
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

export function hasFixRequestedForEpic(epic: Pick<Epic, 'epicId' | 'latestRunId' | 'targetApp' | 'targetApps'>, runs: ExecutionRun[]): boolean {
  const latestRun = latestRunForEpic(epic, runs)
  if (latestRun?.reviewStatus === 'needs_followup') return true
  return runs.some((run) => (
    run.epicId === epic.epicId &&
    run.reviewStatus === 'needs_followup' &&
    typeof run.fixPrompt === 'string' &&
    run.fixPrompt.trim().length > 0
  ))
}

export function hasReviewPendingForEpic(epic: Pick<Epic, 'epicId' | 'latestRunId' | 'targetApp' | 'targetApps'>, runs: ExecutionRun[]): boolean {
  const latestRun = latestRunForEpic(epic, runs)
  return latestRun?.runStatus !== 'failed' && (latestRun?.reviewStatus === 'not_reviewed' || latestRun?.reviewStatus === 'copied')
}

export function deriveWorkItemStatus(epic: Epic, context: StatusContext): WorkItemStatus {
  if (epic.status === 'done' || epic.status === 'merged') return 'done'
  if (epic.decisionPolicy === 'manual' || epic.factoryEligible === false) return 'manual'
  const dangerous = hasDangerRisk(epic.riskFlags)
  const latestRun = latestRunForEpic(epic, context.runs)
  if (dangerous || latestRun?.runStatus === 'failed' || (epic.blockers ?? []).length > 0 || epic.status === 'blocked') return 'blocked'

  const pendingApproval = context.approvals.some((approval) => approval.epicId === epic.epicId && approval.status === 'pending')
  if (pendingApproval || epic.decisionPolicy === 'approval_required') return 'waiting_user'
  if (latestRun?.reviewStatus === 'needs_human') return 'waiting_user'

  if (epic.queueControl?.hold === true || epic.status === 'paused') return 'ai_hold'
  if (epic.epicId.startsWith('epic-goalstep-') && latestRun?.runStatus === 'completed') return 'review_waiting'
  // ただのレビュー待ち(not_reviewed)/修正依頼(needs_followup)は止めない。危険・判断要のゲートを通過していれば
  // factoryEligible に従って executable とする。fixRequested/reviewPending は toEpicItem 側で
  // status==='executable' のときフラグ付与＆boostする。
  // ※ ここで factoryEligible を無視して executable を返すと、対象外Epic(factoryEligible未設定)が
  //    status=executable になりつつ候補(factoryEligible===true)から漏れ、全リストから消える不整合になる。
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

  if (input.fixRequested) {
    score += REVIEW_FIX_SCORE_BOOST
    factors.push('要修正あり')
  }
  if (input.autonomyAnchor) {
    score += AUTONOMY_ANCHOR_SCORE_BOOST
    factors.push('自走化・最優先アンカー')
  }

  score += PRIORITY_SCORE[priority]
  factors.push(`優先度${epicPriorityLabel(priority)}`)

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
  epic: Pick<Epic, 'epicId' | 'goalId' | 'blockers' | 'factoryEligible' | 'decisionPolicy' | 'riskFlags' | 'queueControl'>,
  status: WorkItemStatus,
  latestRun: ExecutionRun | undefined,
  hasPendingApproval: boolean,
): QueueResolution | undefined {
  const goalId = epic.goalId ?? 'unassigned'
  const decideHref = (tab: 'today' | 'review' | 'candidates' | 'aiHold', extras: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams({ tab, goalId })
    for (const [key, value] of Object.entries(extras)) {
      if (value) params.set(key, value)
    }
    return `/decide?${params.toString()}`
  }
  switch (status) {
    case 'executable':
    case 'done':
      return undefined
    case 'review_waiting':
      return {
        how: '互換ステータスです。通常の未レビューだけなら自動実行は止めません。レビュー以外の停止理由がないか確認してください。',
        actionLabel: 'Inboxでレビューする',
        actionHref: decideHref('review', { focusRunId: latestRun?.runId }),
      }
    case 'waiting_user': {
      if (hasPendingApproval || epic.decisionPolicy === 'approval_required') {
        return {
          how: 'ユーザー判断が必要なため自動実行を停止中です。Inboxの「今日の判断」で方針を決めると、AIが自動実行できます。',
          actionLabel: 'Inboxで承認する',
          actionHref: decideHref('today'),
        }
      }
      if (latestRun?.reviewStatus === 'needs_followup') {
        return {
          how: '修正依頼が残っています。Inboxのレビュータブで要修正の内容を確認し、修正候補を進めると次に進めます。',
          actionLabel: 'Inboxで要修正を見る',
          actionHref: decideHref('review', { filter: 'needs_followup', focusRunId: latestRun.runId }),
        }
      }
      if (latestRun?.reviewStatus === 'needs_human') {
        return {
          how: 'AIだけでは判断できなかった作業です。Inboxのレビュータブで該当レビューを確認すると、次に進めます。',
          actionLabel: 'Inboxでレビューする',
          actionHref: decideHref('review', { focusRunId: latestRun.runId }),
        }
      }
      return {
        how: 'ユーザー判断が必要なため自動実行を停止中です。Inboxの「今日の判断」で方針を決めると、AIが自動実行できます。',
        actionLabel: 'Inboxで判断する',
        actionHref: decideHref('today'),
      }
    }
    case 'blocked': {
      const blocker = (epic.blockers ?? [])[0]
      const risks = dangerRiskFlags(epic.riskFlags)
      return {
        how: risks.length > 0
          ? `危険操作を含むためBlockしています（理由: ${risks.join(' / ')}）。人手で内容を確認し、安全に分割してください。`
          : blocker
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
        actionLabel: 'AI保留を見る',
        actionHref: decideHref('aiHold'),
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
