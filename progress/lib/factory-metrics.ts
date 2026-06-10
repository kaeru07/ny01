import { readJson } from '@/lib/store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getAutomationLog, getOperationalDecisions, getPendingApprovals } from '@/lib/operations-store'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'
import { listNotReviewed, oldestAgeDays } from '@/lib/ai-review'
import type { RecommendedEpic } from '@/types/recommended-epic'

// Factory を安全に動かすための最低限の計測。新しい正本は作らない（既存 JSON / ndjson から都度算出）。

export const BACKPRESSURE_SLOW_THRESHOLD = 10
export const BACKPRESSURE_PAUSE_THRESHOLD = 20
const STALE_SUGGESTED_DAYS = 7

export type BackpressureLevel = 'ok' | 'slow_down' | 'pause'

export interface FactoryMetrics {
  /** Knowledge化された run ÷ 全 run（running を除く）。 */
  closedLoopRate: number
  knowledgeCount: number
  totalRuns: number
  notReviewedCount: number
  oldestNotReviewedAgeDays: number | null
  needsHumanCount: number
  needsFollowupCount: number
  suggestedEpicCount: number
  /** suggested のまま STALE_SUGGESTED_DAYS 日以上更新されていない候補数。 */
  staleSuggestedCount: number
  /** 今日（サーバーローカル日付）の意思決定件数。 */
  dailyDecisionCount: number
  pendingApprovalCount: number
  factoryLastResult: string | null
  factoryLastError: string | null
  backpressure: {
    level: BackpressureLevel
    slowThreshold: number
    pauseThreshold: number
    message: string
  }
  computedAt: string
}

function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function backpressureLevel(notReviewedCount: number): BackpressureLevel {
  if (notReviewedCount > BACKPRESSURE_PAUSE_THRESHOLD) return 'pause'
  if (notReviewedCount > BACKPRESSURE_SLOW_THRESHOLD) return 'slow_down'
  return 'ok'
}

export function backpressureMessage(level: BackpressureLevel, notReviewedCount: number): string {
  if (level === 'pause') {
    return `not_reviewed=${notReviewedCount} > ${BACKPRESSURE_PAUSE_THRESHOLD}: Factory自動実行は停止候補（レビュー滞留の解消が先）`
  }
  if (level === 'slow_down') {
    return `not_reviewed=${notReviewedCount} > ${BACKPRESSURE_SLOW_THRESHOLD}: Factoryは減速運転（maxRuns=1）`
  }
  return `not_reviewed=${notReviewedCount}: 正常（しきい値 ${BACKPRESSURE_SLOW_THRESHOLD} 以下）`
}

export async function computeFactoryMetrics(): Promise<FactoryMetrics> {
  const [runs, knowledge, decisions, recommendations, automationLog, pendingApprovals] = await Promise.all([
    readExecutionRuns(),
    getKnowledgeRecords(),
    getOperationalDecisions(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
    getAutomationLog(50),
    getPendingApprovals(),
  ])

  const countableRuns = runs.filter((r) => r.runStatus !== 'running')
  const knowledgeRunIds = new Set(knowledge.map((k) => k.sourceRunId))
  const closedLoopRuns = countableRuns.filter((r) => knowledgeRunIds.has(r.runId)).length

  const notReviewed = listNotReviewed(runs)

  const today = localYmd(new Date())
  const dailyDecisionCount = decisions.filter((d) => {
    const at = new Date(d.decidedAt)
    return !Number.isNaN(at.getTime()) && localYmd(at) === today
  }).length

  const suggested = recommendations.filter((r) => r.status === 'suggested')
  const staleBefore = Date.now() - STALE_SUGGESTED_DAYS * 86_400_000
  const staleSuggested = suggested.filter((r) => {
    const t = new Date(r.updatedAt ?? r.createdAt ?? '').getTime()
    return !Number.isNaN(t) && t < staleBefore
  })

  // factory_last_result: 最新の factory 由来 Run（source=factory_runner）を優先し、
  // 無ければ automation-log の factory 系イベント（factory_schedule / factory_backpressure 等）から拾う。
  const factoryRuns = runs.filter((r) => r.factoryRun || r.source === 'factory_runner')
  const lastFactoryRun = factoryRuns[0] ?? null
  const lastFactoryLog = automationLog.find((e) => String(e.event).startsWith('factory'))
  const factoryLastResult = lastFactoryRun
    ? `${lastFactoryRun.runId}: ${lastFactoryRun.runStatus}（${lastFactoryRun.stopReason ?? 'stopReason未記録'}）`
    : lastFactoryLog
      ? `${lastFactoryLog.event}: ${lastFactoryLog.fallbackReason ?? ''}（${lastFactoryLog.at.slice(0, 16)}）`
      : null

  const lastFailedFactoryRun = factoryRuns.find((r) => r.runStatus === 'failed' || r.runStatus === 'partial')
  const factoryLastError = lastFailedFactoryRun
    ? `${lastFailedFactoryRun.runId}: ${lastFailedFactoryRun.runStatus}（${lastFailedFactoryRun.errors[0] ?? lastFailedFactoryRun.stopReason ?? '詳細未記録'}）`
    : null

  const level = backpressureLevel(notReviewed.length)

  return {
    closedLoopRate: countableRuns.length > 0 ? closedLoopRuns / countableRuns.length : 0,
    knowledgeCount: knowledge.length,
    totalRuns: countableRuns.length,
    notReviewedCount: notReviewed.length,
    oldestNotReviewedAgeDays: oldestAgeDays(notReviewed),
    needsHumanCount: runs.filter((r) => r.reviewStatus === 'needs_human').length,
    needsFollowupCount: runs.filter((r) => r.reviewStatus === 'needs_followup').length,
    suggestedEpicCount: suggested.length,
    staleSuggestedCount: staleSuggested.length,
    dailyDecisionCount,
    pendingApprovalCount: pendingApprovals.length,
    factoryLastResult,
    factoryLastError,
    backpressure: {
      level,
      slowThreshold: BACKPRESSURE_SLOW_THRESHOLD,
      pauseThreshold: BACKPRESSURE_PAUSE_THRESHOLD,
      message: backpressureMessage(level, notReviewed.length),
    },
    computedAt: new Date().toISOString(),
  }
}
