import type { GoalImportInput, GoalStatus, GoalTodoStatus, MonetizationImpact } from '@/types/goal'
import type { CandidateStatus, MonetizationCandidate } from '@/types/monetization'

const PHASE_ID = 'phase-monetization-candidates'

const STATUS_TO_GOAL_STATUS: Record<CandidateStatus, GoalStatus> = {
  Draft: 'proposed',
  Candidate: 'proposed',
  Review: 'proposed',
  Hold: 'paused',
  Approved: 'active',
  Rejected: 'dropped',
  EpicCreated: 'active',
  Building: 'active',
  Released: 'done',
}

const STATUS_TO_TODO_STATUS: Record<CandidateStatus, GoalTodoStatus> = {
  Draft: 'pending',
  Candidate: 'pending',
  Review: 'pending',
  Hold: 'skipped',
  Approved: 'active',
  Rejected: 'skipped',
  EpicCreated: 'done',
  Building: 'active',
  Released: 'done',
}

export function mapCandidateStatusToGoalStatus(status: CandidateStatus): GoalStatus {
  return STATUS_TO_GOAL_STATUS[status]
}

function impactForScore(score: number): MonetizationImpact {
  if (score >= 80) return 'high'
  if (score >= 60) return 'medium'
  if (score > 0) return 'low'
  return 'none'
}

function compactLines(lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => Boolean(line && line.trim())).join('\n')
}

function vaultReference(candidate: MonetizationCandidate): string {
  return candidate.links?.vault
    ?? candidate.evidenceLinks?.find((link) => link.path.includes('05_monetization'))?.path
    ?? candidate.sourceRefs?.find((source) => source.type === 'vault')?.path
    ?? '05_monetization/収益化候補一覧.md'
}

export function buildMonetizationCandidateGoalImport(candidate: MonetizationCandidate): GoalImportInput {
  const goalStatus = mapCandidateStatusToGoalStatus(candidate.status)
  const todoStatus = STATUS_TO_TODO_STATUS[candidate.status]
  const vault = vaultReference(candidate)
  const nextAction = candidate.nextAction || 'Progress側で次アクションを具体化する'

  return {
    projectId: candidate.targetApp || 'company-mgmt',
    goalTitle: `収益化候補: ${candidate.name}`,
    goalSummary: compactLines([
      `${candidate.status} から ${goalStatus} として引き継ぐ。score=${candidate.score} / category=${candidate.category}。`,
      candidate.whyNow?.summary,
      `Vault詳細: ${vault}`,
    ]),
    priority: candidate.score >= 80 ? 'high' : candidate.score >= 60 ? 'medium' : 'low',
    monetizationImpact: impactForScore(candidate.score),
    phases: [
      {
        id: PHASE_ID,
        title: '収益化候補のProgress移行',
        summary: 'Vault由来の候補状態をProgressのGoal/Todoへ引き継ぐ',
        order: 0,
        status: todoStatus === 'done' ? 'done' : goalStatus === 'active' ? 'in_progress' : 'todo',
      },
    ],
    todos: [
      {
        id: `gtodo-monetization-${candidate.id}`,
        phaseId: PHASE_ID,
        title: `${candidate.name} の次アクションをProgressで進める`,
        role: candidate.status === 'Approved' || candidate.status === 'Building' ? 'claude' : 'human',
        order: 0,
        priority: candidate.score >= 80 ? 'high' : 'medium',
        status: todoStatus,
        nextAction,
        doneCriteria: [
          '候補の状態がProgress側のGoal/Todo状態へ引き継がれている',
          'Vault側の詳細本文を複製せず、参照リンクだけで追える',
          '公開・課金・本番設定が必要な作業はmanual/approval_requiredとして分離されている',
        ],
        taskPrompt: compactLines([
          `対象候補: ${candidate.name} (${candidate.id})`,
          `現在状態: ${candidate.status} / score=${candidate.score}`,
          `次アクション: ${nextAction}`,
          `Vault詳細: ${vault}`,
        ]),
        memo: compactLines([
          `Vault詳細: ${vault}`,
          candidate.notes,
          candidate.links?.epicId ? `既存Epic: ${candidate.links.epicId}` : undefined,
        ]),
        decisionPolicy: 'autonomous',
        riskFlags: [],
        source: 'ai_generated',
        dependsOn: [],
      },
    ],
    addToQueueRoles: goalStatus === 'active' && todoStatus === 'active' ? ['claude'] : [],
  }
}

export function buildMonetizationCandidateGoalImports(
  candidates: MonetizationCandidate[],
): GoalImportInput[] {
  return candidates.map(buildMonetizationCandidateGoalImport)
}
