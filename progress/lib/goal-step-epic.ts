import { getEpics, createEpic } from '@/lib/operations-store'
import { readGoals, rankGoals, goalRankOf, goalAchievement } from '@/lib/goal-reader'
import { dangerRiskFlags } from '@/lib/auto-queue-score'
import { selectSkillForEpic } from '@/lib/skill-select'
import type { Goal, GoalTodo } from '@/types/goal'
import type { EpicPriority } from '@/lib/types/operations'

/** 「open（まだ閉じていない）」とみなす Epic ステータス。これらが goalId に紐づいていれば作業中とみなす。 */
const OPEN_EPIC_STATUSES = new Set(['active', 'approved', 'paused'])

function priorityOfGoal(goal: Goal): EpicPriority {
  if (goal.priority === 'high') return 'P0'
  if (goal.priority === 'low') return 'P2'
  return 'P1'
}

function priorityOfTodo(todo: GoalTodo, goal: Goal): EpicPriority {
  if (todo.priority === 'high') return 'P0'
  if (todo.priority === 'medium') return 'P1'
  if (todo.priority === 'low') return 'P2'
  return priorityOfGoal(goal)
}

function sourceTodoForGoal(goal: Goal, sourceTodoId?: string): GoalTodo | undefined {
  if (!sourceTodoId) return undefined
  return goal.todos.find((todo) => todo.id === sourceTodoId)
}

function defaultDoneCriteriaForGoal(goal: Goal): string[] {
  if (goal.id.startsWith('goal-app-')) {
    return [
      '現在フェーズ(基盤/機能完成/品質仕上げ/公開準備)を特定し、そのフェーズの具体的な変更を1つ以上実装する',
      'tsc/build/lint と主要フローの実描画・実操作確認まで検証を通す',
      'summaryに現在フェーズと出来るようになったことを人間語で記録し、公開準備完了時は提出待ちであることを明記する',
    ]
  }
  return [
    'このGoalの達成に向けた、次の具体的で検証可能な1ステップを定義する',
    '定義したステップを実装・実行し、該当する検証（tsc / build / 動作確認など）まで完了する',
    'ExecutionRunに結果を記録し、Goalの達成度を前進させる',
  ]
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
  const sourceTodo = sourceTodoForGoal(target, sourceTodoId)
  const title = sourceTodo
    ? `${target.title}: ${sourceTodo.title}`
    : `${target.title}: 次の一歩`
  const goalText = sourceTodo
    ? [
        `Goal「${target.title}」配下ToDo「${sourceTodo.title}」を実行する。`,
        sourceTodo.nextAction ? `次のアクション: ${sourceTodo.nextAction}` : '',
        sourceTodo.taskPrompt ? `作業指示: ${sourceTodo.taskPrompt}` : '',
        target.summary ? `Goal概要: ${target.summary}` : '',
      ].filter(Boolean).join('\n')
    : `Goal「${target.title}」の達成に向けて、次の具体的な1ステップを進める。${target.summary ?? ''}`.trim()
  const doneCriteria = sourceTodo?.doneCriteria.length
    ? sourceTodo.doneCriteria
    : defaultDoneCriteriaForGoal(target)

  const skill = await selectSkillForEpic({
    epicId: `epic-goalstep-${target.id}`,
    goalId: target.id,
    targetApp: target.projectId,
    title,
    goal: goalText,
  })
  const epic = await createEpic({
    epicId: `epic-goalstep-${target.id}`,
    goalId: target.id,
    skillId: skill?.skill.id,
    title,
    goal: goalText,
    decisionPolicy: sourceTodo?.decisionPolicy ?? target.decisionPolicyDefault ?? 'autonomous',
    doneCriteria,
    priority: sourceTodo ? priorityOfTodo(sourceTodo, target) : priorityOfGoal(target),
    riskFlags: sourceTodo?.riskFlags ?? target.riskFlagsDefault ?? [],
    factoryEligible: true,
    targetApp: target.projectId,
    relatedTodoIds: sourceTodoId ? [sourceTodoId] : undefined,
    preferredExecutor: sourceTodo?.role === 'codex' ? 'codex' : skill?.skill.preferredExecutor ?? 'claude',
    notes: sourceTodo
      ? `GoalTodoから自動生成した「次の一歩」Epic（todoId=${sourceTodo.id}）。完了後はGoalTodoの消化状況に反映する。${sourceTodo.memo ? `\nTodoメモ: ${sourceTodo.memo}` : ''}`
      : 'todo/epicの無い未達成Goalから自動生成した「次の一歩」Epic（ensureNextGoalStepEpic）。完了後もGoal未達成なら次のstep-epicが作られる。',
  })
  return { created: true, epicId: epic.epicId, goalId: target.id, goalTitle: target.title }
}
