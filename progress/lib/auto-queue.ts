import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals, rankGoals, goalRankOf, goalAchievement } from '@/lib/goal-reader'
import { listInboxItems } from '@/lib/inbox-reader'
import { computeQueueScore, dangerRiskFlags, deriveResolution, deriveWorkItemStatus, hasFixRequestedForEpic, hasReviewPendingForEpic, latestRunForEpic, normalizePriority } from '@/lib/auto-queue-score'
import { isAutonomyAnchorEpic, REVIEW_FIX_SCORE_BOOST, AUTONOMY_ANCHOR_SCORE_BOOST } from '@/lib/autonomy-anchor'
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
    review_waiting: 'レビュー確認状態',
    blocked: 'ブロック中',
    manual: '手動または対象外',
    done: '完了済み',
  }
  return statusLabel[status]
}

function reasonFromFactors(status: WorkItemStatus, factors: string[], goalTitle: string | undefined, pinnedTop: boolean): string {
  if (status !== 'executable') {
    const blockedReason = status === 'waiting_user' ? 'ユーザー判断が必要' : statusBlockedReason(status)
    if (pinnedTop) return `最優先指定中。ただし${blockedReason}のため、次回自動実行候補には入りません`
    return `${blockedReason}のため、次回自動実行候補には入りません`
  }
  if (factors.includes('要修正あり')) return '要修正あり・次回自動実行で優先修正（fixPrompt反映）'
  if (factors.includes('自走化・最優先アンカー')) return '自走化・最優先アンカーのため次回自動実行で優先'
  if (factors.includes('レビュー未確認あり')) return 'レビュー未確認あり（自動実行は継続）'
  const core = factors.filter((f) => f !== 'factoryEligible')
  if (core.length === 0) return '実行可能条件を満たしているため候補入り'
  const suffix = goalTitle ? ` / Goal「${goalTitle}」配下` : ''
  return `${core.slice(0, 4).join('＋')} のため上位候補${suffix}`
}

function blockedReasonForEpic(epic: Epic, latestRun: ExecutionRun | undefined): string | undefined {
  const risks = dangerRiskFlags(epic.riskFlags)
  if (risks.length > 0) return `危険操作を含むためBlock（理由: ${risks.join(' / ')}）`
  if (latestRun?.runStatus === 'failed') return '前回実行がfailedのためBlock'
  if ((epic.blockers ?? []).length > 0) return `ブロック要因あり（${(epic.blockers ?? []).join(' / ')}）`
  if (epic.status === 'blocked') return 'Epicがblocked状態'
  return undefined
}

function toEpicItem(epic: Epic, goal: Goal | undefined, runs: ExecutionRun[], status: WorkItemStatus, approvals: Approval[]): AutoQueueItem {
  const latestRun = latestRunForEpic(epic, runs)
  const lastRunAt = runAt(latestRun)
  const hasPendingApproval = approvals.some((a) => a.epicId === epic.epicId && a.status === 'pending')
  const fixRequested = status === 'executable' && hasFixRequestedForEpic(epic, runs)
  const reviewPending = status === 'executable' && hasReviewPendingForEpic(epic, runs)
  const autonomyAnchor = status === 'executable' && isAutonomyAnchorEpic(epic)
  const score = computeQueueScore({
    priority: epic.priority,
    queueControl: epic.queueControl,
    lastRunAt,
    nextAction: epic.nextAction,
    updatedAt: epic.updatedAt,
    factoryEligible: epic.factoryEligible,
    fixRequested,
    autonomyAnchor,
  }, goal)
  const reasonFactors = [
    ...score.reasonFactors,
    ...(reviewPending ? ['レビュー未確認あり'] : []),
  ]
  const total = epic.doneCriteria?.length ?? 0
  const candidateEligible = epic.factoryEligible === true && status === 'executable'
  const candidateBlockedReason = candidateEligible
    ? undefined
    : status === 'blocked'
      ? blockedReasonForEpic(epic, latestRun) ?? statusBlockedReason(status)
      : status === 'waiting_user'
        ? 'ユーザー判断が必要'
        : statusBlockedReason(status)
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
    candidateBlockedReason,
    reviewPending,
    fixRequested,
    autonomyAnchor,
    resolution: candidateEligible ? undefined : deriveResolution(epic, status, latestRun, hasPendingApproval),
    reason: reasonFromFactors(status, reasonFactors, goal?.title, epic.queueControl?.pinnedTop === true),
    reasonFactors: reasonFactors.length > 0 ? reasonFactors : [status],
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
  const dangerous = dangerRiskFlags(todo.riskFlags).length > 0
  const status: WorkItemStatus = todo.status === 'done' || todo.status === 'skipped'
    ? 'done'
    : dangerous
      ? 'blocked'
    : todo.decisionPolicy === 'approval_required'
      ? 'waiting_user'
    : todo.decisionPolicy === 'manual'
      ? 'manual'
    : todo.queueControl?.hold === true
      ? 'ai_hold'
    : todo.dependsOn.length > 0
      ? 'ai_hold'
      : 'executable'
  const score = computeQueueScore({
    priority,
    queueControl: todo.queueControl,
    nextAction: todo.nextAction,
    updatedAt: todo.updatedAt,
    factoryEligible: status === 'executable',
  }, goal)
  const candidateEligible = status === 'executable'
  const source = todo.source ?? 'goal_resume'
  return {
    workItemId: `todo:${todo.id}`,
    type: 'goal_todo',
    sourceId: todo.id,
    todoId: todo.id,
    source,
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
    candidateBlockedReason: candidateEligible
      ? undefined
      : dangerous
        ? `危険操作を含むためBlock（理由: ${dangerRiskFlags(todo.riskFlags).join(' / ')}）`
        : statusBlockedReason(status),
    resolution: candidateEligible
      ? undefined
      : dangerous
        ? { how: 'riskFlags が危険操作を含むため、承認またはリスク除去が必要です。' }
        : { how: status === 'waiting_user' ? '承認が必要です。Goal詳細で内容を確認してください。' : '依存する作業の完了待ちです。先行する作業が終わると自動で候補に戻ります。' },
    reason: reasonFromFactors(status, score.reasonFactors, goal.title, todo.queueControl?.pinnedTop === true),
    reasonFactors: score.reasonFactors.length > 0 ? score.reasonFactors : [status],
    queueControl: todo.queueControl,
  }
}

/** 安全枠の据置度。要修正(fix) > 自走化アンカー(anchor) の順を boost 値の大小で表す。 */
function safetyValue(item: AutoQueueItem): number {
  return (item.fixRequested ? REVIEW_FIX_SCORE_BOOST : 0) + (item.autonomyAnchor ? AUTONOMY_ANCHOR_SCORE_BOOST : 0)
}

/**
 * 並び順（上位→下位）:
 *  1. 明示pin（手動最優先・絶対上位）
 *  2. 安全枠（要修正優先 / 自走化アンカー）
 *  3. Goal順（rankGoals: pin>boost>優先度、未設定は末尾）
 *  4. Goal内（手動順 → score → 優先度 → 直近実行）
 * goalRank を渡すと「Goalの並びがキュー順を決める」。未指定時は Goal順を無視（後方互換）。
 */
function goalPriority(goal: Goal): 'P0' | 'P1' | 'P2' {
  if (goal.priority === 'high') return 'P0'
  if (goal.priority === 'low') return 'P2'
  return 'P1'
}

/**
 * Goal そのものを 1 つの作業単位（type='goal'）にする。
 * todo も epic も無い未達成 Goal を「達成まで自動実行する対象」としてキューに載せるため。
 * Factory はこの item を拾うと『次の一歩を Epic 化して進める』（goalの安全ポリシーを継承）。
 */
function toGoalItem(goal: Goal): AutoQueueItem {
  const priority = goalPriority(goal)
  const dangerous = dangerRiskFlags(goal.riskFlagsDefault).length > 0
  const status: WorkItemStatus = dangerous
    ? 'blocked'
    : goal.decisionPolicyDefault === 'approval_required'
      ? 'waiting_user'
    : goal.decisionPolicyDefault === 'manual'
      ? 'manual'
      : 'executable'
  const achievement = goalAchievement(goal)
  const score = computeQueueScore({
    priority,
    queueControl: goal.pinnedTop ? { pinnedTop: true } : undefined,
    nextAction: goal.summary,
    updatedAt: goal.updatedAt,
    factoryEligible: status === 'executable',
  }, goal)
  const candidateEligible = status === 'executable'
  return {
    workItemId: `goal:${goal.id}`,
    type: 'goal',
    sourceId: goal.id,
    source: 'goal_resume',
    title: `${goal.title}（達成まで自動で進める）`,
    goalId: goal.id,
    goalTitle: goal.title,
    projectId: goal.projectId,
    projectName: goal.projectId,
    status,
    priority,
    factoryEligible: status === 'executable',
    decisionPolicy: goal.decisionPolicyDefault ?? 'autonomous',
    preferredExecutor: 'claude',
    doneCriteriaTotal: 100,
    doneCriteriaDone: achievement,
    blockers: [],
    updatedAt: goal.updatedAt,
    queueScore: score.queueScore,
    queueOrder: 0,
    candidateEligible,
    candidateBlockedReason: candidateEligible
      ? undefined
      : dangerous
        ? `危険操作を含むためBlock（理由: ${dangerRiskFlags(goal.riskFlagsDefault).join(' / ')}）`
        : statusBlockedReason(status),
    resolution: candidateEligible
      ? undefined
      : dangerous
        ? { how: 'Goal の riskFlagsDefault が危険操作を含むため、承認またはリスク除去が必要です。', actionLabel: 'Goal詳細', actionHref: `/goal-planner?goalId=${encodeURIComponent(goal.id)}` }
        : status === 'waiting_user'
          ? { how: 'この Goal は承認が必要な方針（approval_required）です。Inboxで承認すると自動で進みます。', actionLabel: 'Inboxで承認する', actionHref: `/decide?tab=today&goalId=${encodeURIComponent(goal.id)}` }
          : { how: 'この Goal は手動方針（manual）です。自動化するには Goal の decisionPolicyDefault を見直してください。', actionLabel: 'Goal詳細', actionHref: `/goal-planner?goalId=${encodeURIComponent(goal.id)}` },
    reason: status === 'executable'
      ? `Goal未達成（達成率${achievement}%）・todo/epicが無いため、次の一歩をEpic化して自動で進めます`
      : reasonFromFactors(status, score.reasonFactors, goal.title, goal.pinnedTop === true),
    reasonFactors: status === 'executable' ? ['Goal達成が目的', '次の一歩を自動Epic化', priority] : (score.reasonFactors.length > 0 ? score.reasonFactors : [status]),
    queueControl: goal.pinnedTop ? { pinnedTop: true } : undefined,
  }
}

function compareItems(a: AutoQueueItem, b: AutoQueueItem, goalRank?: Map<string, number>): number {
  const ap = a.queueControl?.pinnedTop === true
  const bp = b.queueControl?.pinnedTop === true
  if (ap !== bp) return ap ? -1 : 1

  const asv = safetyValue(a)
  const bsv = safetyValue(b)
  if (asv !== bsv) return bsv - asv

  if (goalRank) {
    const ar = goalRankOf(goalRank, a.goalId)
    const br = goalRankOf(goalRank, b.goalId)
    if (ar !== br) return ar - br
  }

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

function buildGoalProgress(goals: Goal[], items: AutoQueueItem[], goalRank: Map<string, number>): GoalProgressRow[] {
  return goals.map((goal) => {
    const goalItems = items.filter((item) => item.goalId === goal.id)
    const executableItems = goalItems.filter((item) => item.status === 'executable').sort((a, b) => compareItems(a, b, goalRank))
    // 進捗の正本は「今/目標」(target/current = goalAchievement)。これが0%問題の修正点。
    // target 未設定のゴールのみ Todo 完了率にフォールバック（goalAchievement 内で処理）。
    const hasTarget = typeof goal.target === 'number' && goal.target > 0
    const todoTotal = goal.todos.length
    const todoDone = goal.todos.filter((todo) => todo.status === 'done' || todo.status === 'skipped').length
    const ratio = goalAchievement(goal)
    const total = hasTarget ? (goal.target as number) : todoTotal
    const done = hasTarget ? (goal.current ?? 0) : todoDone
    const latestItem = goalItems
      .map((item) => ({ item, at: item.lastRunAt ?? item.updatedAt }))
      .filter((entry): entry is { item: AutoQueueItem; at: string } => Boolean(entry.at))
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]?.item
    const executable = executableItems.length
    return {
      goalId: goal.id,
      title: goal.title,
      projectId: goal.projectId,
      total,
      done,
      ratio,
      executable,
      nextCandidateCount: executable,
      waitingUser: goalItems.filter((item) => item.status === 'waiting_user').length,
      aiHold: goalItems.filter((item) => item.status === 'ai_hold').length,
      reviewWaiting: goalItems.filter((item) => item.status === 'review_waiting').length,
      reviewFixRequested: goalItems.filter((item) => item.fixRequested).length,
      blocked: goalItems.filter((item) => item.status === 'blocked').length,
      manual: goalItems.filter((item) => item.status === 'manual').length,
      lastRunAt: latestItem?.lastRunAt ?? latestItem?.updatedAt,
      latestWorkTitle: latestItem?.title,
      nextActionTitle: executableItems[0]?.title,
      priorityBoost: goal.priorityBoost,
      pinnedTop: goal.pinnedTop,
    }
  }).sort((a, b) => {
    // Goal行の並びも rankGoals に揃える（キュー順の第一キーと一致させる）。
    const ar = goalRankOf(goalRank, a.goalId)
    const br = goalRankOf(goalRank, b.goalId)
    if (ar !== br) return ar - br
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
  const goalRank = rankGoals(goals)
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

  // todo も epic も無い未達成 Goal も「達成が目的」としてキューに載せる。
  // （Goal達成までFactoryが次の一歩をEpic化して進めるための入口。既に作業itemがあるGoalには出さない）
  const goalsWithItems = new Set(items.map((item) => item.goalId).filter((id): id is string => Boolean(id)))
  for (const goal of goals) {
    if (goal.status !== 'active') continue
    if (goalsWithItems.has(goal.id)) continue
    if (goalAchievement(goal) >= 100) continue
    items.push(toGoalItem(goal))
  }

  const cmp = (a: AutoQueueItem, b: AutoQueueItem) => compareItems(a, b, goalRank)

  const executable = items
    .filter((item) => item.factoryEligible === true && item.status === 'executable')
    .sort(cmp)
    .map((item, index) => ({ ...item, queueOrder: index + 1 }))

  const withExecutableOrder = new Map(executable.map((item) => [item.workItemId, item]))
  const merged = items.map((item) => withExecutableOrder.get(item.workItemId) ?? item)
  const pinnedExcluded = merged
    .filter((item) => item.queueControl?.pinnedTop === true && item.status !== 'executable')
    .sort(cmp)

  return {
    next: executable[0] ?? null,
    candidates: executable.slice(1, 4),
    executable,
    waitingUser: merged.filter((item) => item.status === 'waiting_user').sort(cmp),
    aiHold: merged.filter((item) => item.status === 'ai_hold').sort(cmp),
    reviewWaiting: merged.filter((item) => item.status === 'review_waiting').sort(cmp),
    blocked: merged.filter((item) => item.status === 'blocked').sort(cmp),
    manual: merged.filter((item) => item.status === 'manual').sort(cmp),
    pinnedExcluded,
    counts: countsOf(merged, inbox.filter((item) => !item.imported).length),
    goalProgress: buildGoalProgress(goals, merged, goalRank),
    generatedAt: new Date().toISOString(),
  }
}

export const getAutoQueueView = buildAutoQueue
