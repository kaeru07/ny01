import {
  getAutomationConfig,
  getEpic,
  evaluateAutoFallback,
  generateCodexPrompt,
  getNextActionCandidates,
  classifyCodexEligibility,
  appendAutomationLog,
  getAutomationLog,
  getFactoryEligibility,
} from './operations-store'
import { addExecutionRun } from './execution-run-writer'
import type { AutomationConfig, AutoResumeResult, AutoResumeState } from './types/operations'
import type { ExecutorType, ExecutionRun } from '@/types/execution-run'

// Auto Resume: Claude 上限後に「安全条件を満たす作業だけ」自動継続する。
//
// 設計原則:
//  - 安全判定は Auto Fallback の既存ゲート（evaluateAutoFallback）を再利用する。ゲートは変更しない。
//    feature-toggle ゲート（kind: 'disabled' = autoFallback OFF / executorMode）だけは除外し、
//    「承認待ち / 決定待ち / requiresClaude / destructive / 候補なし」の安全ゲートのみを採用する。
//  - executor 非依存。rate-limited（claude）でない有効 executor を選んで再開する。将来 executor 追加可能。
//  - 新しい正本は作らない。記録は ExecutionRun（addExecutionRun）と Automation Log（auto_resume）に残す。
//  - handoff/プロンプトは生成ビュー（正本ではない）として再利用する。

function generateRunId(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

// rate-limited（claude）でない有効 executor を返す。将来 executor を増やすときはここを拡張する。
function pickResumeExecutor(config: AutomationConfig): ExecutorType | undefined {
  if (config.executorMode === 'claude') return undefined // claude 専任 → 上限中は再開不可
  // both / codex → 現状の非 claude executor は codex
  return 'codex'
}

async function getLastResumedAt(): Promise<string | undefined> {
  const log = await getAutomationLog(50)
  const last = log.find((e) => e.event === 'auto_resume' && e.resumeState === 'auto_resumed')
  return last?.at
}

async function countResumableSafeWork(): Promise<{ count: number; titles: string[] }> {
  const candidates = await getNextActionCandidates(30)
  const safe = candidates.filter((c) => classifyCodexEligibility(c.title).eligible)
  return { count: safe.length, titles: safe.slice(0, 5).map((c) => c.title) }
}

/**
 * Auto Resume の評価（副作用なし）。状態と再開可否を返す。
 * justTriggered=true のときだけ state を 'auto_resumed' に上げる（トリガ直後の表示用）。
 */
export async function evaluateAutoResume(
  epicId?: string,
  opts: { justTriggered?: boolean } = {},
): Promise<AutoResumeResult> {
  const now = new Date().toISOString()
  const [config, epic, fallback, lastResumedAt, resumable] = await Promise.all([
    getAutomationConfig(),
    epicId ? getEpic(epicId) : Promise.resolve(null),
    evaluateAutoFallback(epicId), // 既存ゲートを再利用（変更しない）
    getLastResumedAt(),
    countResumableSafeWork(),
  ])

  // feature-toggle ゲート（disabled）は除外し、安全ゲートだけを採用する。
  const safetyBlocks = fallback.blocked.filter((b) => b.kind !== 'disabled')
  const safe = safetyBlocks.length === 0
  const resumeExecutor = pickResumeExecutor(config)

  // Epic スコープ時は Epic Contract（Factory 対象判定）も満たすこと。
  // 不完全な Epic（goal/doneCriteria/priority 欠落・riskFlags・manual 等）は自動再開対象にしない。
  let eligibilityNote: string | undefined
  if (epic) {
    const elig = await getFactoryEligibility(epic.epicId)
    if (elig && !elig.eligible) eligibilityNote = `Epic契約が不足/自動対象外: ${elig.reasons.join(' / ')}`
  }

  let state: AutoResumeState
  let executorNote: string | undefined
  if (!config.autoResume) {
    state = 'paused'
  } else if (!safe) {
    state = 'blocked'
  } else if (eligibilityNote) {
    state = 'blocked'
    executorNote = eligibilityNote
  } else if (!resumeExecutor) {
    state = 'blocked'
    executorNote = '再開可能な executor がありません（executorMode=claude のため、上限中は再開できません）'
  } else {
    state = opts.justTriggered ? 'auto_resumed' : 'running'
  }

  const canResume = state === 'running' || state === 'auto_resumed'

  // canResume のときだけ再開コンテキスト（プロンプト生成ビュー）を作る。
  const resumeContext = canResume ? await generateCodexPrompt(epicId) : undefined

  return {
    autoResumeEnabled: config.autoResume,
    state,
    canResume,
    resumableCount: resumable.count,
    lastResumedAt,
    resumeExecutor,
    blockedReasons: safetyBlocks,
    executorNote,
    resumeContext,
    epicId: epic?.epicId,
    epicTitle: epic?.title,
    evaluatedAt: now,
  }
}

/**
 * Auto Resume のトリガ。canResume なら ExecutionRun + Automation Log に記録して state を auto_resumed にする。
 * 再開不可（paused / blocked）なら記録だけ残して現状の評価を返す（実行はしない）。
 */
export async function triggerAutoResume(epicId?: string): Promise<AutoResumeResult> {
  const evaluated = await evaluateAutoResume(epicId, { justTriggered: true })

  if (!evaluated.canResume) {
    await appendAutomationLog({
      event: 'auto_resume',
      resumeState: evaluated.state,
      resumableCount: evaluated.resumableCount,
      fallbackReason: 'claude_rate_limited',
      epicId,
    })
    return evaluated
  }

  const { count, titles } = await countResumableSafeWork()
  const executor = evaluated.resumeExecutor ?? 'codex'
  const runId = generateRunId()

  // 自動再開アクションそのものを ExecutionRun として記録する（保存仕様は変更しない／既存 addExecutionRun を使用）。
  const run: ExecutionRun = {
    runId,
    startedAt: evaluated.evaluatedAt,
    finishedAt: new Date().toISOString(),
    targetApp: 'progress',
    epicId,
    targetTodoTitle: `Auto Resume: 安全作業${count}件を${executor}向けに再開`,
    runStatus: 'completed',
    reviewStatus: 'not_reviewed',
    source: 'auto_resume',
    executorUsed: executor,
    autoFallback: true,
    fallbackReason: 'claude_rate_limited',
    summary: `Claude 上限後、安全条件（承認・決定・requiresClaude・destructive なし）を満たす作業 ${count} 件を ${executor} 向けに自動再開した`,
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: titles,
    rawReport: evaluated.resumeContext?.promptText ?? '（再開コンテキストなし）',
  }
  await addExecutionRun(run)

  await appendAutomationLog({
    event: 'auto_resume',
    resumeState: 'auto_resumed',
    resumableCount: count,
    resumeExecutor: executor,
    resumeRunId: runId,
    fallbackReason: 'claude_rate_limited',
    epicId,
  })

  return { ...evaluated, state: 'auto_resumed', lastResumedAt: run.finishedAt }
}
