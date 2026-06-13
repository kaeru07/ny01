import {
  getEpics,
  getEpicDetail,
  classifyCodexEligibility,
  generateCodexPrompt,
  appendAutomationLog,
  getAutomationConfig,
} from './operations-store'
import { buildExecutionGuard } from './epic-contract'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import type { Epic } from '@/lib/types/operations'
import type { ExecutionRun } from '@/types/execution-run'

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

  const allRuns = await readExecutionRuns()
  const humanFixInstructions = collectHumanFixInstructions(epic, allRuns)
  const nextTitles = nextActions.map((a) => a.title)
  const text = `${epic.goal} ${nextTitles.join(' ')}`
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
      ? `${epic.priority ?? 'P?'} / 契約OK / 安全に dispatch 可能（${executorCandidate}）`
      : `dispatch 不可: ${blockedReason}`

  return {
    dispatchPlanId: newPlanId(epicId),
    epicId,
    epicTitle: epic.title,
    goal: epic.goal,
    doneCriteria: epic.doneCriteria ?? [],
    selectedReason,
    executorCandidate,
    preferredExecutor: epic.preferredExecutor,
    fallbackExecutor: epic.fallbackExecutor,
    canRunOnCodex,
    requiresClaude,
    requiresApproval,
    approvalStatus,
    decisionStatus,
    riskFlags,
    nextActions: nextTitles,
    humanFixInstructions,
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
  const epics = await getEpics()
  const priorityOf = new Map(epics.map((e) => [e.epicId, e.priority]))
  const active = epics.filter((e) => e.status === 'active' || e.status === 'paused')
  const plans = (await Promise.all(active.map((e) => buildDispatchPlan(e.epicId)))).filter(
    (p): p is FactoryDispatchPlan => p !== null,
  )

  const rank = (epicId: string) => {
    const p = priorityOf.get(epicId)
    return p ? PRIORITY_RANK[p] : 9
  }
  const candidates = plans
    .filter((p) => p.safetyStatus === 'ok')
    .sort((a, b) => rank(a.epicId) - rank(b.epicId))
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
