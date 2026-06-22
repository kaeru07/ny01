import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import { getAutomationConfig, appendAutomationLog } from './operations-store'
import { computeFactoryStatus } from './factory-status'
import { runFactory } from './factory-runner'
import { runReviewFixDispatch } from './review-fix-runner'
import { runPromptQueueDispatch } from './prompt-queue-runner'
import { addExecutionRun, updateExecutionRunFields } from './execution-run-writer'
import { syncCandidatesFromVault } from './monetization-vault-sync'
import { backfillFollowupRecommendations } from './knowledge-loop'
import { expireStaleRecommendations } from './recommended-epics-store'
import { rotateExecutionRunsArchive } from './execution-run-archive'
import { checkAutonomyCompletionAndNotify } from './autonomy-notification'
import type { ExecutionRun } from '@/types/execution-run'
import type { FactoryRunReport } from './executors/types'

// factory-schedule: スケジューラ（systemd timer / cron / boot）から Factory を「ユーザー操作なし」で起動する入口。
// P3 の責務は「起動するか否かの安全判定 + 二重起動防止 + 起動記録」だけ。
// 実際の Run ループ・安全ゲート（blocked / approval / riskFlags / decision 待ち）は既存の runFactory に委譲する。
// 禁止: 複数 Epic ループの新規実装 / 既存安全ゲートの変更 / Approval・riskFlags Epic の実行。

/** スケジュール起動の発生源。 */
export type ScheduleSource = 'schedule' | 'boot'
/** スケジュール起動のトリガ手段。 */
export type ScheduleTrigger = 'systemd' | 'cron' | 'startup'

const LOCK_FILE = 'factory-schedule.lock'
/** ロックが残ったまま死んだ場合に備え、この時間を超えた lock は stale として奪取する。 */
const LOCK_STALE_MS = 2 * 60 * 60 * 1000

export interface ScheduleRunInput {
  source: ScheduleSource
  trigger: ScheduleTrigger
  maxRuns?: number
  maxPerEpic?: number
  /** テスト用に runFactory を実起動せず擬似化したい場合のオプションを素通しする。 */
  passthrough?: Record<string, unknown>
}

export interface ScheduleRunResult {
  triggered: boolean
  skipped: boolean
  skipReason?: string
  source: ScheduleSource
  trigger: ScheduleTrigger
  factoryEnabled: boolean
  factoryRunState?: string
  stoppedReason?: string
  runsExecuted: number
  promptQueueExecuted?: number
  promptQueueReserved?: number
  promptQueueSkipped?: number
  promptQueueBlocked?: number
  reviewFixExecuted?: number
  reviewFixReserved?: number
  reviewFixSkipped?: number
  reviewFixBlocked?: number
  taggedRunIds: string[]
  promptQueueRunIds?: string[]
  reviewFixRunIds?: string[]
  envelopeRunId: string
  startedAt: string
  finishedAt: string
}

function generateRunId(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function lockPath(): string {
  return path.join(getDataPath(), LOCK_FILE)
}

interface LockInfo {
  pid: number
  startedAt: string
  source: string
  trigger: string
}

/** 実行中ロックを取得する。既に有効な lock があれば null（= 二重起動なので skip）。 */
async function acquireLock(source: string, trigger: string): Promise<boolean> {
  const file = lockPath()
  try {
    const raw = await fs.readFile(file, 'utf-8')
    const info = JSON.parse(raw) as LockInfo
    const age = Date.now() - Date.parse(info.startedAt)
    if (Number.isFinite(age) && age < LOCK_STALE_MS) {
      // 有効な lock が存在 → 実行中とみなして取得失敗（skip）。
      return false
    }
    // stale lock は奪取する。
  } catch {
    // lock 無し / 壊れている → 取得続行。
  }
  await fs.mkdir(path.dirname(file), { recursive: true })
  const info: LockInfo = { pid: process.pid, startedAt: new Date().toISOString(), source, trigger }
  await fs.writeFile(file, JSON.stringify(info), 'utf-8')
  return true
}

async function releaseLock(): Promise<void> {
  try {
    await fs.rm(lockPath(), { force: true })
  } catch {
    /* noop */
  }
}

async function recordEnvelope(args: {
  source: ScheduleSource
  trigger: ScheduleTrigger
  runStatus: ExecutionRun['runStatus']
  summary: string
  rawReport: string
  startedAt: string
  stoppedReason?: string
  runsExecuted: number
}): Promise<string> {
  const runId = generateRunId()
  const now = new Date().toISOString()
  const run: ExecutionRun = {
    runId,
    startedAt: args.startedAt,
    finishedAt: now,
    targetApp: 'progress',
    targetTodoTitle: `Factory schedule (${args.source}/${args.trigger})`,
    runStatus: args.runStatus,
    reviewStatus: 'not_reviewed',
    source: args.source,
    trigger: args.trigger,
    factoryRun: true,
    runnerMode: 'auto',
    stopReason: args.stoppedReason,
    summary: args.summary,
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: args.rawReport,
  }
  await addExecutionRun(run)
  return runId
}

/**
 * スケジューラ（systemd timer / cron / boot service）から呼ばれる Factory 起動入口。
 * 起動条件: factoryEnabled=true かつ factoryRunState !== 'Blocked'。
 * 二重起動防止: lock ファイルが有効なら skip='already_running'。
 * 起動後は runFactory(auto) が生成した各 Run に source / trigger を後付けし、
 * さらに 1 件の envelope ExecutionRun（source / trigger / 結果サマリー）を必ず残す。
 */
export async function runScheduledFactory(input: ScheduleRunInput): Promise<ScheduleRunResult> {
  const startedAt = new Date().toISOString()
  const base = {
    triggered: false,
    skipped: true,
    source: input.source,
    trigger: input.trigger,
    runsExecuted: 0,
    taggedRunIds: [] as string[],
  }

  // 0) 収益化候補の定期取り込み（Vault→Hub）。
  //    Factory ON/OFF・Blocked に関わらず毎回実行する（取り込みは候補追加のみで安全）。
  //    best-effort: 失敗しても Factory 本体は止めない（Vault は読み取りのみ・Epic化なし）。
  try {
    const sync = await syncCandidatesFromVault({ source: input.source, trigger: input.trigger })
    if (sync.added > 0 || sync.updated > 0) {
      await appendAutomationLog({
        event: 'monetization_sync',
        fallbackReason: `added=${sync.added} updated=${sync.updated}`,
        detectionStatus: input.source,
      } as never)
    }
  } catch {
    // 取り込み失敗は無視して Factory 本体へ進む
  }

  // 0.5) AI候補の棚卸し。修正依頼は候補へ戻し、古い suggested は期限切れにする。
  try {
    const [followup, expired] = await Promise.all([
      backfillFollowupRecommendations(),
      expireStaleRecommendations(),
    ])
    if (followup.createdRecommendations > 0 || expired.expired > 0) {
      await appendAutomationLog({
        event: 'factory_schedule',
        fallbackReason: `followupCreated=${followup.createdRecommendations} expiredRecommendations=${expired.expired}`,
        detectionStatus: input.source,
      } as never)
    }
  } catch {
    // 候補整理に失敗しても本体起動判定は続ける
  }

  // 0.6) 作業履歴の自動整理。300件未満では何もしない。
  try {
    const archive = await rotateExecutionRunsArchive()
    if (archive.shouldRotate) {
      await appendAutomationLog({
        event: 'factory_schedule',
        fallbackReason: `executionRunsArchived=${archive.archiveCount} active=${archive.activeCountAfter} archive=${archive.archiveFilename}`,
        detectionStatus: input.source,
      } as never)
    }
  } catch {
    // アーカイブ整理に失敗してもFactory本体は止めない
  }

  // 1) Factory ON/OFF（OFF なら何も起動しない）
  const config = await getAutomationConfig()
  if (!config.factoryEnabled) {
    const envelopeRunId = await recordEnvelope({
      source: input.source,
      trigger: input.trigger,
      runStatus: 'completed',
      summary: `Factory OFF のため起動しません（${input.source}/${input.trigger}）`,
      rawReport: `[factory-schedule] skip=factory_off source=${input.source} trigger=${input.trigger}`,
      startedAt,
      stoppedReason: 'factory_off',
      runsExecuted: 0,
    })
    await appendAutomationLog({ event: 'factory_schedule', fallbackReason: 'factory_off', detectionStatus: input.source } as never)
    return { ...base, factoryEnabled: false, skipReason: 'factory_off', envelopeRunId, startedAt, finishedAt: new Date().toISOString() }
  }

  // 2) 起動条件: state !== Blocked
  const status = await computeFactoryStatus()
  if (status.factoryRunState === 'Blocked') {
    const envelopeRunId = await recordEnvelope({
      source: input.source,
      trigger: input.trigger,
      runStatus: 'completed',
      summary: `factoryRunState=Blocked のため起動しません（${input.source}/${input.trigger}）`,
      rawReport: `[factory-schedule] skip=blocked source=${input.source} trigger=${input.trigger} state=${status.factoryRunState}`,
      startedAt,
      stoppedReason: 'blocked',
      runsExecuted: 0,
    })
    await appendAutomationLog({ event: 'factory_schedule', fallbackReason: 'blocked', detectionStatus: input.source } as never)
    return {
      ...base,
      factoryEnabled: true,
      factoryRunState: status.factoryRunState,
      skipReason: 'blocked',
      envelopeRunId,
      startedAt,
      finishedAt: new Date().toISOString(),
    }
  }

  // 3) 二重起動防止
  const locked = await acquireLock(input.source, input.trigger)
  if (!locked) {
    const envelopeRunId = await recordEnvelope({
      source: input.source,
      trigger: input.trigger,
      runStatus: 'completed',
      summary: `Factory 実行中のため skip（二重起動防止 / ${input.source}/${input.trigger}）`,
      rawReport: `[factory-schedule] skip=already_running source=${input.source} trigger=${input.trigger}`,
      startedAt,
      stoppedReason: 'already_running',
      runsExecuted: 0,
    })
    await appendAutomationLog({ event: 'factory_schedule', fallbackReason: 'already_running', detectionStatus: input.source } as never)
    return {
      ...base,
      factoryEnabled: true,
      factoryRunState: status.factoryRunState,
      skipReason: 'already_running',
      envelopeRunId,
      startedAt,
      finishedAt: new Date().toISOString(),
    }
  }

  // 4) 起動（auto / confirm）。Epic ループ・安全ゲートは runFactory に委譲（P3 では何も変えない）。
  try {
    const reviewFix = await runReviewFixDispatch({
      mode: 'auto',
      confirm: true,
      maxItems: 1,
    })
    const report: FactoryRunReport = await runFactory({
      mode: 'auto',
      confirm: true,
      maxRuns: input.maxRuns,
      maxPerEpic: input.maxPerEpic,
      ...(input.passthrough ?? {}),
    })
    const promptQueue = await runPromptQueueDispatch({
      mode: 'auto',
      confirm: true,
      maxItems: 1,
    })

    // runFactory が記録した各 Run に source / trigger を後付け（誰がスケジュール起動したかを残す）。
    const taggedRunIds: string[] = []
    for (const step of report.steps) {
      if (step.recordedRunId) {
        await updateExecutionRunFields(step.recordedRunId, { source: input.source, trigger: input.trigger })
        taggedRunIds.push(step.recordedRunId)
      }
    }
    const promptQueueRunIds = promptQueue.steps.map((step) => step.runId).filter((runId): runId is string => Boolean(runId))
    const reviewFixRunIds = reviewFix.steps.map((step) => step.followupRunId).filter((runId): runId is string => Boolean(runId))

    const runStatus: ExecutionRun['runStatus'] =
      report.runsExecuted > 0 || promptQueue.executed > 0 || promptQueue.reserved > 0 || reviewFix.executed > 0 || reviewFix.reserved > 0
        ? 'completed'
        : 'partial'
    const envelopeRunId = await recordEnvelope({
      source: input.source,
      trigger: input.trigger,
      runStatus,
      summary: `Factory 起動: Review Fix 実行${reviewFix.executed}・予約${reviewFix.reserved}・skip${reviewFix.skipped}・block${reviewFix.blocked} / Epic ${report.runsExecuted} Run / Prompt Queue 実行${promptQueue.executed}・予約${promptQueue.reserved}・skip${promptQueue.skipped}・block${promptQueue.blocked} / 停止理由=${report.stoppedReason}（${input.source}/${input.trigger}）`,
      rawReport: [
        `[review-fix] considered=${reviewFix.considered} executed=${reviewFix.executed} reserved=${reviewFix.reserved} skipped=${reviewFix.skipped} blocked=${reviewFix.blocked} stopped=${reviewFix.stoppedReason} runIds=${reviewFixRunIds.join(',') || 'none'}`,
        `[factory-schedule] source=${input.source} trigger=${input.trigger} runs=${report.runsExecuted} stopped=${report.stoppedReason} tagged=${taggedRunIds.join(',') || 'none'}`,
        `[prompt-queue] considered=${promptQueue.considered} executed=${promptQueue.executed} reserved=${promptQueue.reserved} skipped=${promptQueue.skipped} blocked=${promptQueue.blocked} stopped=${promptQueue.stoppedReason} runIds=${promptQueueRunIds.join(',') || 'none'}`,
      ].join('\n'),
      startedAt,
      stoppedReason: report.stoppedReason,
      runsExecuted: report.runsExecuted + promptQueue.executed + promptQueue.reserved + reviewFix.executed + reviewFix.reserved,
    })

    await appendAutomationLog({ event: 'factory_schedule', fallbackReason: report.stoppedReason, detectionStatus: input.source } as never)
    try {
      await checkAutonomyCompletionAndNotify()
    } catch {
      await appendAutomationLog({ event: 'factory_schedule', fallbackReason: 'autonomy_notify_failed', detectionStatus: input.source } as never)
    }

    return {
      triggered: true,
      skipped: false,
      source: input.source,
      trigger: input.trigger,
      factoryEnabled: true,
      factoryRunState: status.factoryRunState,
      stoppedReason: report.stoppedReason,
      runsExecuted: report.runsExecuted + promptQueue.executed + promptQueue.reserved + reviewFix.executed + reviewFix.reserved,
      promptQueueExecuted: promptQueue.executed,
      promptQueueReserved: promptQueue.reserved,
      promptQueueSkipped: promptQueue.skipped,
      promptQueueBlocked: promptQueue.blocked,
      reviewFixExecuted: reviewFix.executed,
      reviewFixReserved: reviewFix.reserved,
      reviewFixSkipped: reviewFix.skipped,
      reviewFixBlocked: reviewFix.blocked,
      taggedRunIds,
      promptQueueRunIds,
      reviewFixRunIds,
      envelopeRunId,
      startedAt,
      finishedAt: new Date().toISOString(),
    }
  } finally {
    await releaseLock()
  }
}
