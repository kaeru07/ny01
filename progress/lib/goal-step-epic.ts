import { getEpics, createEpic } from '@/lib/operations-store'
import { readGoals, rankGoals, goalRankOf, goalAchievement } from '@/lib/goal-reader'
import { dangerRiskFlags } from '@/lib/auto-queue-score'
import type { Goal } from '@/types/goal'
import type { EpicPriority } from '@/lib/types/operations'

/** 「open（まだ閉じていない）」とみなす Epic ステータス。これらが goalId に紐づいていれば作業中とみなす。 */
const OPEN_EPIC_STATUSES = new Set(['active', 'approved', 'paused'])

function priorityOfGoal(goal: Goal): EpicPriority {
  if (goal.priority === 'high') return 'P0'
  if (goal.priority === 'low') return 'P2'
  return 'P1'
}

/** Factory が自動で達成を目指してよい Goal か（active・未達成・安全＝承認/手動/危険でない）。 */
export function isAutoAdvanceGoal(goal: Goal): boolean {
  if (goal.status !== 'active') return false
  if (goalAchievement(goal) >= 100) return false
  if (goal.decisionPolicyDefault === 'manual' || goal.decisionPolicyDefault === 'approval_required') return false
  if (dangerRiskFlags(goal.riskFlagsDefault).length > 0) return false
  return true
}

export type EnsureGoalStepResult =
  | { created: false }
  | { created: true; epicId: string; goalId: string; goalTitle: string }

/**
 * todo も open epic も無い未達成 active Goal のうち、Goal順（rankGoals）で最上位の 1 件について
 * 「次の一歩」Epic を 1 つだけ作成する。
 *
 * - idempotent: 既に open epic を持つ Goal は対象外（1 Goal につき同時に 1 つの step-epic だけ）。
 *   step-epic が done になり Goal が未達成なら、次回また新しい step-epic が作られる（達成まで繰り返す）。
 * - 安全: 承認要 / 手動 / 危険 riskFlags の Goal は対象外。step-epic は Goal の decisionPolicyDefault /
 *   riskFlagsDefault を継承し、通常の Factory 安全ゲートを通る。
 * - **Factory の実起動経路からのみ呼ぶこと**（read 経路＝画面表示やAPI GET では呼ばない。表示の度に epic を作らないため）。
 */
export async function ensureNextGoalStepEpic(targetGoalId?: string, sourceTodoId?: string): Promise<EnsureGoalStepResult> {
  const [epics, goalsData] = await Promise.all([getEpics(), readGoals()])
  const goalsWithOpenEpic = new Set(
    epics.filter((e) => OPEN_EPIC_STATUSES.has(e.status) && e.goalId).map((e) => e.goalId as string),
  )
  const target = targetGoalId
    ? goalsData.goals.find((goal) => (
        goal.id === targetGoalId &&
        isAutoAdvanceGoal(goal) &&
        !goalsWithOpenEpic.has(goal.id)
      ))
    : (() => {
        const rank = rankGoals(goalsData.goals)
        return goalsData.goals
          .filter((goal) => isAutoAdvanceGoal(goal) && !goalsWithOpenEpic.has(goal.id))
          .sort((a, b) => goalRankOf(rank, a.id) - goalRankOf(rank, b.id))[0]
      })()
  if (!target) return { created: false }

  const epic = await createEpic({
    epicId: `epic-goalstep-${target.id}`,
    goalId: target.id,
    title: `${target.title}: 次の一歩`,
    goal: `Goal「${target.title}」の達成に向けて、次の具体的な1ステップを進める。${target.summary ?? ''}`.trim(),
    decisionPolicy: target.decisionPolicyDefault ?? 'autonomous',
    doneCriteria: [
      'このGoalの達成に向けた、次の具体的で検証可能な1ステップを定義する',
      '定義したステップを実装・実行し、該当する検証（tsc / build / 動作確認など）まで完了する',
      'ExecutionRunに結果を記録し、Goalの達成度を前進させる',
    ],
    priority: priorityOfGoal(target),
    riskFlags: target.riskFlagsDefault ?? [],
    factoryEligible: true,
    targetApp: target.projectId,
    relatedTodoIds: sourceTodoId ? [sourceTodoId] : undefined,
    notes: 'todo/epicの無い未達成Goalから自動生成した「次の一歩」Epic（ensureNextGoalStepEpic）。完了後もGoal未達成なら次のstep-epicが作られる。',
  })
  return { created: true, epicId: epic.epicId, goalId: target.id, goalTitle: target.title }
}
