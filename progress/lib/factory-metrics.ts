import { readJson } from '@/lib/store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getAutomationLog, getEpics, getOperationalDecisions, getPendingApprovals } from '@/lib/operations-store'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'
import { listNotReviewed, oldestAgeDays } from '@/lib/ai-review'
import { DANGER_CATEGORIES, isReviewApprovalOptions } from '@/lib/inbox-labels'
import { dangerScopeLabels, summarizeDangerApprovalScopes } from '@/lib/danger-approval-scope'
import { readGoals } from '@/lib/goal-reader'
import type { RecommendedEpic } from '@/types/recommended-epic'

// Factory を安全に動かすための最低限の計測。新しい正本は作らない（既存 JSON / ndjson から都度算出）。

// 2026-06-11 運用方針変更: レビュー件数では工場を止めない（レビュー100件でも稼働可能）。
// 停止要因は「人間しか判断できないもの」のみ:
//   - 危険判断待ち（本番・課金・認証・公開系の承認）→ 紐付く対象だけ停止。対象不明なら全体停止
//   - Goal未設定 → 該当Epicを対象外（全対象EpicがGoal未設定なら実質停止）
//   - 人間作業 → AIはそもそも触らない（他のEpicは稼働継続）
const STALE_SUGGESTED_DAYS = 7

export type BackpressureLevel = 'ok' | 'pause'

export interface FactoryBlockers {
  /** 危険判断待ちの承認件数 */
  dangerApprovalCount: number
  /** 紐付け先が分からず、工場全体を止める危険判断待ち */
  unscopedDangerApprovalCount: number
  /** 紐付け先が分かり、該当プロジェクト/Goal/Epicだけ止める危険判断待ち */
  scopedDangerApprovalCount: number
  /** 一部停止対象の人間向けラベル */
  scopedDangerLabels: string[]
  /** Goal未設定のオープンEpic件数（該当Epicのみ対象外） */
  goalUnsetEpicCount: number
  /** Goal設定済みでFactoryが拾えるオープンEpic件数 */
  runnableEpicCount: number
}

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
  /** 工場停止要因（人間しか判断できないもの）。レビュー件数は含まない */
  blockers: FactoryBlockers
  backpressure: {
    level: BackpressureLevel
    message: string
  }
  computedAt: string
}

function localYmd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function backpressureLevel(blockers: FactoryBlockers): BackpressureLevel {
  if (blockers.unscopedDangerApprovalCount > 0) return 'pause'
  if (blockers.runnableEpicCount === 0 && blockers.goalUnsetEpicCount > 0) return 'pause'
  return 'ok'
}

export function backpressureMessage(level: BackpressureLevel, blockers: FactoryBlockers): string {
  if (level === 'pause') {
    if (blockers.unscopedDangerApprovalCount > 0) {
      return `スコープ不明の危険判断待ち=${blockers.unscopedDangerApprovalCount}件: 対象を特定できないためFactory自動実行を停止`
    }
    return `Goal未設定Epic=${blockers.goalUnsetEpicCount}件・実行可能Epic=0: Goalを紐付けるまでFactory自動実行を停止`
  }
  if (blockers.scopedDangerApprovalCount > 0) {
    return `危険判断待ち${blockers.scopedDangerApprovalCount}件: ${blockers.scopedDangerLabels.join('、')}のみ停止、他プロジェクトは稼働`
  }
  return `停止要因なし（危険判断待ち0・実行可能Epic ${blockers.runnableEpicCount}件）。レビュー件数では停止しません`
}

export async function computeFactoryMetrics(): Promise<FactoryMetrics> {
  const [runs, knowledge, decisions, recommendations, automationLog, pendingApprovals, epics, goalsData] = await Promise.all([
    readExecutionRuns(),
    getKnowledgeRecords(),
    getOperationalDecisions(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
    getAutomationLog(50),
    getPendingApprovals(),
    getEpics(),
    readGoals(),
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

  // 工場停止要因（レビュー件数は無関係）
  const dangerApprovals = pendingApprovals.filter(
    (a) => DANGER_CATEGORIES.has(a.category) && !isReviewApprovalOptions(a.options.map((o) => o.label)),
  )
  const dangerScopes = summarizeDangerApprovalScopes(dangerApprovals, {
    epics,
    goals: goalsData.goals,
    runs,
  })
  const openEpicStatuses = new Set(['approved', 'active'])
  const openEpics = epics.filter((e) => openEpicStatuses.has(e.status))
  const goalUnsetEpics = openEpics.filter((e) => !e.goalId)
  const blockers: FactoryBlockers = {
    dangerApprovalCount: dangerApprovals.length,
    unscopedDangerApprovalCount: dangerScopes.unscoped.length,
    scopedDangerApprovalCount: dangerScopes.scoped.length,
    scopedDangerLabels: dangerScopeLabels(dangerScopes),
    goalUnsetEpicCount: goalUnsetEpics.length,
    runnableEpicCount: openEpics.length - goalUnsetEpics.length,
  }
  const level = backpressureLevel(blockers)

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
    blockers,
    backpressure: {
      level,
      message: backpressureMessage(level, blockers),
    },
    computedAt: new Date().toISOString(),
  }
}
