import {
  getEpics,
  getEpicDetail,
  classifyCodexEligibility,
  generateCodexPrompt,
  appendAutomationLog,
  getAutomationConfig,
  getPendingApprovals,
} from './operations-store'
import { buildExecutionGuard } from './epic-contract'
import { buildDecisionContext } from './decision-context'
import { selectSkillForEpic, skillPromptBlock } from './skill-select'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals, rankGoals, goalRankOf } from '@/lib/goal-reader'
import { computeQueueScore, deriveWorkItemStatus, hasFixRequestedForEpic, latestRunForEpic } from '@/lib/auto-queue-score'
import type { Epic } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'
import { AUTONOMY_ANCHOR_SCORE_BOOST, REVIEW_FIX_SCORE_BOOST, autonomyAnchorReason, isAutonomyAnchorEpic } from '@/lib/autonomy-anchor'

/** この Epic に紐づく「人間の修正指示」を集める。
 *  (1) needs_followup の Run に保存された fixPrompt（新しい順）, (2) 承認済みで remainingWork に入った修正指示。
 *  これを dispatch プロンプトに最優先項目として載せ、次回自動実行で人間の修正依頼が実際に反映されるようにする。 */
function collectHumanFixInstructions(epic: Pick<Epic, 'epicId' | 'remainingWork'>, runs: ExecutionRun[]): string[] {
  const fromRuns = runs
    .filter((r) => r.epicId === epic.epicId && r.reviewStatus === 'needs_followup' && !!r.fixPrompt && r.fixPrompt.trim().length > 0)
    .sort((a, b) => Date.parse(b.fixRequestedAt || b.finishedAt || b.startedAt) - Date.parse(a.fixRequestedAt || a.finishedAt || a.startedAt))
    .map((r) => r.fixPrompt!.trim())
  const fromRemaining = (epic.remainingWork ?? []).filter((w) => /修正指示|人間の修正/.test(w)).map((w) => w.trim())
  return Array.from(new Set([...fromRuns, ...fromRemaining]))
}
import type {
  ExecutorType,
  ExecutorChoice,
  DispatchPromptType,
  FactoryDispatchPlan,
  FactoryDispatchScan,
  DispatchPromptResult,
  CodexPrompt,
  EpicPriority,
} from './types/operations'

// Factory Dispatch（準備フェーズ）。
// scan/pick で選ばれた Epic を Claude / Codex / manual の executor へ「渡す準備」をする。
// 完全自動ループ・CLI 直叩き・cron/pm2/systemd は使わない。新しい正本は作らない
// （Dispatch Plan は既存正本から都度生成するビュー。結果は ExecutionRun に記録）。

const PRIORITY_RANK: Record<EpicPriority, number> = { P0: 0, P1: 1, P2: 2 }

function newPlanId(epicId: string): string {
  return `dp-${epicId}-${Date.now().toString(36)}`
}

function asChoice(e?: ExecutorType): ExecutorChoice | undefined {
  return e === 'claude' || e === 'codex' || e === 'manual' ? e : undefined
}

/** 1 Epic の Dispatch Plan（生成ビュー）を作る。 */
export async function buildDispatchPlan(epicId: string): Promise<FactoryDispatchPlan | null> {
  const detail = await getEpicDetail(epicId)
  if (!detail) return null
  const { epic, nextActions, pendingApprovals, factoryEligibility } = detail

  const [allRuns, goalsData] = await Promise.all([readExecutionRuns(), readGoals()])
  const goalTitle = goalsData.goals.find((goal) => goal.id === epic.goalId)?.title
  const humanFixInstructions = collectHumanFixInstructions(epic, allRuns)
  const autonomyAnchor = isAutonomyAnchorEpic(epic)
  const explicitNextActions = [
    epic.nextAction,
    ...(epic.remainingWork ?? []),
    ...nextActions.map((a) => a.title),
  ]
    .map((action) => action?.trim())
    .filter((action): action is string => Boolean(action))
    // 「具体的な次アクションを登録する」だけの循環指示は作業指示として再利用しない。
    .filter((action) => !/nextAction.*remainingWork|具体的.*nextAction/i.test(action))
  const nextTitles = explicitNextActions.length > 0
    ? Array.from(new Set(explicitNextActions))
    : [
        `既存実装を調査し、DoneCriteria「${(epic.doneCriteria ?? [])[0] ?? 'Goal達成に必要な条件'}」を前進させる最小の未実装1件を特定して実装する。変更は1〜3ファイル程度に限定し、方針決定が必要なら変更せず理由を報告する`,
      ]
  // Codex適格性は作業目的だけでなく、実際に求める検証内容も含めて判定する。
  // 自動生成のstep-epicは nextActions が空でも doneCriteria に test/build 等の
  // 安全シグナルを持つため、ここを除外すると常にClaude専任と誤判定される。
  const text = `${epic.goal} ${(epic.doneCriteria ?? []).join(' ')} ${nextTitles.join(' ')}`
  const codexEligible = classifyCodexEligibility(text).eligible
  const canRunOnCodex =
    factoryEligibility.eligible &&
    (epic.fallbackExecutor === 'codex' || epic.preferredExecutor === 'codex' || codexEligible)
  const requiresClaude = epic.preferredExecutor === 'claude' && !canRunOnCodex

  const approvalStatus: 'none' | 'pending' = pendingApprovals.length > 0 ? 'pending' : 'none'
  const decisionStatus: 'ok' | 'waiting' = pendingApprovals.length > 0 ? 'waiting' : 'ok'
  const requiresApproval = epic.decisionPolicy === 'approval_required'
  const riskFlags = epic.riskFlags ?? []

  let safetyStatus: 'ok' | 'blocked'
  let blockedReason: string | undefined
  let executorCandidate: ExecutorChoice
  let promptType: DispatchPromptType

  if (epic.decisionPolicy === 'manual') {
    safetyStatus = 'blocked'
    executorCandidate = 'manual'
    blockedReason = 'decisionPolicy=manual（自動対象外）'
    promptType = 'none'
  } else if (!factoryEligibility.eligible) {
    safetyStatus = 'blocked'
    blockedReason = factoryEligibility.reasons.join(' / ')
    executorCandidate = requiresClaude ? 'claude' : asChoice(epic.preferredExecutor) ?? 'claude'
    promptType = 'none'
  } else {
    safetyStatus = 'ok'
    if (requiresClaude) {
      executorCandidate = 'claude'
      promptType = 'claude_factory'
    } else if (canRunOnCodex) {
      executorCandidate = epic.preferredExecutor === 'claude' ? 'claude' : 'codex'
      promptType = executorCandidate === 'claude' ? 'claude_factory' : 'codex_handoff'
    } else {
      executorCandidate = 'claude'
      promptType = 'claude_factory'
    }
  }

  const selectedReason =
    safetyStatus === 'ok'
      ? [
        autonomyAnchor ? autonomyAnchorReason() : null,
        humanFixInstructions.length > 0 ? '人間の修正指示あり' : null,
        `${epic.priority ?? 'P?'} / 契約OK / 安全に dispatch 可能（${executorCandidate}）`,
      ].filter(Boolean).join(' / ')
      : `dispatch 不可: ${blockedReason}`

  return {
    dispatchPlanId: newPlanId(epicId),
    epicId,
    epicTitle: epic.title,
    goalId: epic.goalId,
    selectedGoalKey: epic.goalId,
    selectedGoalTitle: goalTitle ?? epic.goal,
    goal: epic.goal,
    doneCriteria: epic.doneCriteria ?? [],
    selectedReason,
    selectedReasonDetail: selectedReason,
    executorCandidate,
    preferredExecutor: epic.preferredExecutor,
    fallbackExecutor: epic.fallbackExecutor,
    canRunOnCodex,
    requiresClaude,
    requiresApproval,
    approvalStatus,
    decisionStatus,
    riskFlags,
    priority: epic.priority,
    decisionPolicy: epic.decisionPolicy,
    nextActions: nextTitles,
    humanFixInstructions,
    autonomyAnchor,
    hasFixPrompt: humanFixInstructions.length > 0,
    promptType,
    safetyStatus,
    blockedReason,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * scan（全 active Epic）→ pick（dispatch 可能を priority 順に並べ先頭を picked）。
 * Factory OFF のときは「一切 scan しない」: candidates/blocked は空で返す。
 */
export async function scanFactoryDispatch(): Promise<FactoryDispatchScan> {
  const config = await getAutomationConfig()
  if (!config.factoryEnabled) {
    return { factoryEnabled: false, picked: null, candidates: [], blocked: [] }
  }
  const [epics, goalsData, runs, approvals] = await Promise.all([
    getEpics(),
    readGoals(),
    readExecutionRuns(),
    getPendingApprovals(),
  ])
  const priorityOf = new Map(epics.map((e) => [e.epicId, e.priority]))
  const epicById = new Map(epics.map((e) => [e.epicId, e]))
  const goalById = new Map(goalsData.goals.map((goal) => [goal.id, goal]))
  const goalRank = rankGoals(goalsData.goals)
  const statusContext = { runs, approvals }
  const active = epics.filter((e) => e.status === 'active' || e.status === 'paused')
  const plans = (await Promise.all(active.map((e) => buildDispatchPlan(e.epicId)))).filter(
    (p): p is FactoryDispatchPlan => p !== null,
  )

  // 安全枠の据置度（要修正 > 自走化アンカー）。Goal順より上位に残す。
  const safetyValue = (plan: FactoryDispatchPlan) =>
    (plan.hasFixPrompt ? REVIEW_FIX_SCORE_BOOST : 0) + (plan.autonomyAnchor ? AUTONOMY_ANCHOR_SCORE_BOOST : 0)
  const queueScore = (plan: FactoryDispatchPlan) => {
    const epic = epicById.get(plan.epicId)
    if (!epic) return 0
    const status = deriveWorkItemStatus(epic, statusContext)
    const latestRun = latestRunForEpic(epic, runs)
    return computeQueueScore({
      priority: epic.priority,
      queueControl: epic.queueControl,
      lastRunAt: latestRun?.finishedAt || latestRun?.startedAt || undefined,
      nextAction: epic.nextAction,
      updatedAt: epic.updatedAt,
      factoryEligible: epic.factoryEligible,
      fixRequested: status === 'executable' && hasFixRequestedForEpic(epic, runs),
      autonomyAnchor: status === 'executable' && isAutonomyAnchorEpic(epic),
    }, epic.goalId ? goalById.get(epic.goalId) : undefined).queueScore
  }
  // 並び順（表示の自動実行キューと同じ階層）:
  //  1. 明示pin → 2. 安全枠（要修正/自走化アンカー）→ 3. 手動順 → 4. Goal順（rankGoals）
  //  5. score → 6. 優先度 → 7. epicId
  const candidates = plans
    .filter((p) => p.safetyStatus === 'ok')
    .sort((a, b) => {
      const ap = epicById.get(a.epicId)?.queueControl?.pinnedTop === true ? 1 : 0
      const bp = epicById.get(b.epicId)?.queueControl?.pinnedTop === true ? 1 : 0
      if (ap !== bp) return bp - ap
      const sv = safetyValue(b) - safetyValue(a)
      if (sv !== 0) return sv
      const am = epicById.get(a.epicId)?.queueControl?.manualOrder
      const bm = epicById.get(b.epicId)?.queueControl?.manualOrder
      if (typeof am === 'number' && typeof bm === 'number' && am !== bm) return am - bm
      if (typeof am === 'number' && typeof bm !== 'number') return -1
      if (typeof bm === 'number' && typeof am !== 'number') return 1
      const gr = goalRankOf(goalRank, a.goalId) - goalRankOf(goalRank, b.goalId)
      if (gr !== 0) return gr
      const qs = queueScore(b) - queueScore(a)
      if (qs !== 0) return qs
      const ar = PRIORITY_RANK[priorityOf.get(a.epicId) ?? 'P2']
      const br = PRIORITY_RANK[priorityOf.get(b.epicId) ?? 'P2']
      if (ar !== br) return ar - br
      return a.epicId.localeCompare(b.epicId)
    })
  const blocked = plans.filter((p) => p.safetyStatus === 'blocked')

  return { factoryEnabled: true, picked: candidates[0] ?? null, candidates, blocked }
}

/** Claude 用 Factory プロンプト（単一プレーンテキスト・安全判定付き・ExecutionRun 記録指示入り）。 */
export async function generateClaudeFactoryPrompt(epicId: string): Promise<CodexPrompt | null> {
  const detail = await getEpicDetail(epicId)
  if (!detail) return null
  const plan = await buildDispatchPlan(epicId)
  if (!plan) return null
  const { epic, latestRun, recentDecisions } = detail
  const goalProjectId = epic.goalId ? (await readGoals()).goals.find((goal) => goal.id === epic.goalId)?.projectId : undefined
  const decisionContext = await buildDecisionContext(
    { epicId: epic.epicId, goalId: epic.goalId, targetApp: epic.targetApps?.[0] },
    goalProjectId,
  )
  const skillSelection = await selectSkillForEpic(epic)

  const lines: string[] = []
  lines.push('あなたは Claude です。以下は Progress（AI工場の管制塔）からの Factory Dispatch です。指定 Epic の作業を進めてください。')
  lines.push('')
  lines.push('[1] 安全判定（最初に確認）')
  lines.push('decisionPolicy / riskFlags / 承認・決定状態を確認し、禁止事項に該当する作業はしないこと。該当時は実行せず blocked として報告。')
  lines.push(`decisionPolicy: ${epic.decisionPolicy}`)
  lines.push(`riskFlags: ${plan.riskFlags.length > 0 ? plan.riskFlags.join(', ') : 'なし'}`)
  lines.push(`承認状態: ${plan.approvalStatus} / 決定状態: ${plan.decisionStatus}`)
  lines.push('')
  lines.push('[2] Epic Goal')
  lines.push(epic.goal)
  lines.push('')
  if (decisionContext) {
    lines.push(decisionContext)
    lines.push('')
  }
  lines.push('[3] DoneCriteria（すべて満たすこと）')
  lines.push(plan.doneCriteria.length > 0 ? plan.doneCriteria.map((c) => `- ${c}`).join('\n') : '- （未設定）')
  lines.push('')
  if (plan.humanFixInstructions.length > 0) {
    lines.push('[3-1] 人間の修正指示（最優先で対応すること）')
    lines.push('人間がレビューで「修正する」と判断し登録した指示です。元作業を確認し、以下を最優先で反映してください。')
    for (const fix of plan.humanFixInstructions) lines.push(`- ${fix}`)
    lines.push('')
  }
  lines.push('[4] 現在地（前回作業）')
  lines.push(latestRun ? `${latestRun.summary}（runId ${latestRun.runId}）` : 'なし')
  lines.push('')
  lines.push('[4-1] Decision Log（この Epic の確定判断・新しい順）')
  lines.push(
    recentDecisions.length > 0
      ? recentDecisions.map((d) => `- ${d.topic} → ${d.decision}（${d.decidedAt}）`).join('\n')
      : '- なし（未確定。方針未決定の設計判断は勝手に確定しない）',
  )
  lines.push('')
  const skillLines = skillPromptBlock(skillSelection)
  if (skillLines.length > 0) {
    lines.push(...skillLines)
    lines.push('')
  }
  lines.push('[5] 次にやること')
  lines.push(plan.nextActions.length > 0 ? plan.nextActions.map((a) => `- ${a}`).join('\n') : '- （Goal と DoneCriteria から導出）')
  lines.push('')
  const guard = buildExecutionGuard(epic.riskFlags)
  lines.push('[6] 禁止事項')
  for (const f of guard.forbidden) lines.push(`- ${f}`)
  if (guard.cautions.length > 0) {
    lines.push('')
    lines.push('[6-1] 注意事項（禁止ではない。進めてよいが報告・確認すること）')
    for (const c of guard.cautions) lines.push(`- ${c}`)
  }
  lines.push('')
  lines.push('[7] 完了後 ExecutionRun へ結果を残す')
  lines.push(
    `POST http://localhost:3010/api/execution-runs に targetApp / targetTodoTitle / runStatus / summary / rawReport を入れ、さらに epicId=${epicId} / executorUsed=claude / factoryDispatch=true / dispatchMode=manual_copy / dispatchPlanId=${plan.dispatchPlanId} / resultReturned=true を含めて登録すること。`,
  )

  return {
    promptText: lines.join('\n'),
    meta: {
      epicId,
      epicTitle: epic.title,
      sourceRunId: latestRun?.runId,
      targetApp: epic.targetApps?.[0],
      nextActionsCount: plan.nextActions.length,
      approvalsPending: detail.pendingApprovals.length,
      hasSafetyGuard: true,
      generatedAt: new Date().toISOString(),
    },
  }
}

/**
 * 指定 executor 向けに dispatch プロンプトを生成する（CLI は呼ばない・コピー用）。
 * safety NG / codex 不可 のときは prompt=null。生成イベントは Automation Log に残す。
 */
export async function dispatchForExecutor(
  epicId: string,
  executor: ExecutorChoice,
): Promise<DispatchPromptResult | null> {
  const plan = await buildDispatchPlan(epicId)
  if (!plan) return null

  let prompt: CodexPrompt | null = null
  let promptType: DispatchPromptType = 'none'

  if (plan.safetyStatus === 'ok') {
    if (executor === 'claude') {
      prompt = await generateClaudeFactoryPrompt(epicId)
      promptType = 'claude_factory'
    } else if (executor === 'codex' && plan.canRunOnCodex) {
      prompt = await generateCodexPrompt(epicId)
      promptType = 'codex_handoff'
    }
  }

  await appendAutomationLog({
    event: 'factory_dispatch',
    dispatchPlanId: plan.dispatchPlanId,
    epicId,
    executorCandidate: executor,
    promptType,
    fallbackReason: plan.safetyStatus === 'blocked' ? plan.blockedReason : undefined,
  })

  return { plan, executor, promptType, prompt }
}
