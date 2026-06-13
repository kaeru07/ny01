import { readExecutionRuns } from '@/lib/execution-run-reader'
import { updateExecutionRunFields } from '@/lib/execution-run-writer'
import { runKnowledgeLoopForRunId } from '@/lib/knowledge-loop'
import { appendAutomationLog, createApproval, getPendingApprovals } from '@/lib/operations-store'
import type { ApprovalCategory } from '@/lib/types/operations'
import type { AiReviewResult, AiReviewVerdict, ExecutionRun, ReviewStatus } from '@/types/execution-run'

// AI一次レビュー（ルールベース・LLM API 不使用）。
// not_reviewed Run を reviewed / needs_human / partial / failed に振り分け、
// reviewed → Knowledge生成ループへ / needs_human → Approval（意思決定キュー）へ /
// partial・failed → needs_followup（修復・再試行候補）へ回す。
// 既存データは削除しない。判定理由は reviewMemo と run.aiReview に残す。

interface RiskRule {
  pattern: RegExp
  label: string
  category: ApprovalCategory
}

// 危険キーワード判定は targetTodoTitle / summary / warnings / stopReason のみ走査する。
// rawReport は議論・引用で危険語が頻出し誤検知が多いため対象外。
const RISK_RULES: RiskRule[] = [
  { pattern: /課金|billing|サブスク|admob|in-?app\s*purchase/i, label: '課金関連', category: 'billing' },
  { pattern: /本番公開|ストア公開|公開申請|リリース申請|deploy|デプロイ|本番反映/i, label: '公開・デプロイ関連', category: 'external_publish' },
  { pattern: /認証|oauth|credential|secret|api[_-]?key|トークン漏|パスワード/i, label: '認証・秘密情報関連', category: 'secret' },
  { pattern: /本番db|production\s*db|migration|スキーマ変更|drop\s+table|truncate/i, label: '本番DB・スキーマ関連', category: 'production_risk' },
  { pattern: /rm\s+-rf|force\s*push|履歴改変|データ初期化|全削除/i, label: '破壊的操作関連', category: 'destructive' },
]

const NG_CHECK_PATTERN = /\b(ng|fail|failed|error)\b|エラー|失敗|✗/i
const OK_CHECK_PATTERN = /^(ok|pass|passed|n\/a|none|skip|skipped|-|未実施)/i

export interface AiReviewClassification {
  verdict: AiReviewVerdict
  reason: string
  rule: string
  approvalCategory?: ApprovalCategory
}

function riskHit(run: ExecutionRun): RiskRule | null {
  const text = [run.targetTodoTitle, run.summary, run.stopReason ?? '', ...run.warnings].join(' ')
  for (const rule of RISK_RULES) {
    if (rule.pattern.test(text)) return rule
  }
  return null
}

function failedChecks(run: ExecutionRun): string[] {
  const hits: string[] = []
  for (const [key, value] of Object.entries(run.checks ?? {})) {
    if (typeof value !== 'string' || !value.trim()) continue
    if (OK_CHECK_PATTERN.test(value.trim())) continue
    if (NG_CHECK_PATTERN.test(value)) hits.push(`${key}=${value}`)
  }
  return hits
}

/** 1 Run をルールベースで分類する（書き込みなしの純粋判定）。 */
export function classifyRun(run: ExecutionRun): AiReviewClassification {
  if (run.runStatus === 'failed') {
    return { verdict: 'failed', rule: 'run_failed', reason: `runStatus=failed（${run.stopReason ?? run.errors[0] ?? '失敗理由未記録'}）。再試行または修復候補。` }
  }
  if (run.runStatus === 'partial') {
    return { verdict: 'partial', rule: 'run_partial', reason: `runStatus=partial（未完了の検証・作業が残っている）。継続または修復候補。` }
  }
  if (run.runStatus === 'running') {
    return { verdict: 'needs_human', rule: 'stale_running', reason: 'runStatus=running のまま放置されている。実際の状態を人間が確認する必要あり。', approvalCategory: 'multi_option' }
  }
  if ((run.stopReason ?? '').includes('approval_required')) {
    return { verdict: 'needs_human', rule: 'approval_required', reason: 'stopReason=approval_required。承認待ちのまま完了扱いになっている。', approvalCategory: 'multi_option' }
  }
  if (run.errors.length > 0) {
    return { verdict: 'needs_human', rule: 'errors_recorded', reason: `completed だが errors が ${run.errors.length} 件記録されている（先頭: ${run.errors[0].slice(0, 80)}）。`, approvalCategory: 'multi_option' }
  }
  const ngChecks = failedChecks(run)
  if (ngChecks.length > 0) {
    return { verdict: 'needs_human', rule: 'check_failed', reason: `completed だが checks に NG がある（${ngChecks.slice(0, 2).join(' / ')}）。`, approvalCategory: 'multi_option' }
  }
  const risk = riskHit(run)
  if (risk) {
    return { verdict: 'needs_human', rule: 'risk_keyword', reason: `${risk.label}の作業（危険キーワード検知）。人間の確認を推奨。`, approvalCategory: risk.category }
  }
  return { verdict: 'reviewed', rule: 'clean_completed', reason: 'completed・errorsなし・checks NGなし・危険キーワードなし。機械判定で問題なし。' }
}

const VERDICT_TO_REVIEW_STATUS: Record<AiReviewVerdict, ReviewStatus> = {
  reviewed: 'reviewed',
  needs_human: 'needs_human',
  partial: 'needs_followup',
  failed: 'needs_followup',
}

export interface AiReviewRunResult {
  runId: string
  title: string
  verdict: AiReviewVerdict
  reason: string
  rule: string
  knowledgeCreated: boolean
  recommendationCreated: boolean
  approvalCreated: boolean
}

export interface AiReviewBatchResult {
  processed: number
  counts: { reviewed: number; needs_human: number; partial: number; failed: number }
  results: AiReviewRunResult[]
  knowledgeCreated: number
  approvalsCreated: number
  /** 処理後に残っている not_reviewed 件数。 */
  notReviewedRemaining: number
  oldestNotReviewedAgeDays: number | null
  executedAt: string
}

export function listNotReviewed(runs: ExecutionRun[]): ExecutionRun[] {
  return runs.filter((r) => r.reviewStatus === 'not_reviewed')
}

export function oldestAgeDays(runs: ExecutionRun[]): number | null {
  if (runs.length === 0) return null
  const oldest = runs.reduce((min, r) => Math.min(min, new Date(r.startedAt).getTime()), Number.POSITIVE_INFINITY)
  if (!Number.isFinite(oldest)) return null
  return Math.max(0, Math.floor((Date.now() - oldest) / 86_400_000))
}

/** not_reviewed Run を新しい順に最大 limit 件、一次レビューして保存する。
 *  「未確認をAIで一括整理」で全件処理できるよう上限は 200 件（過大な一括書き込みの安全弁）。 */
export async function runAiReviewBatch(limit = 10): Promise<AiReviewBatchResult> {
  const runs = await readExecutionRuns() // startedAt 降順
  const targets = listNotReviewed(runs).slice(0, Math.max(1, Math.min(limit, 200)))
  const pendingApprovals = await getPendingApprovals()
  const counts = { reviewed: 0, needs_human: 0, partial: 0, failed: 0 }
  const results: AiReviewRunResult[] = []
  let knowledgeCreated = 0
  let approvalsCreated = 0

  for (const run of targets) {
    const cls = classifyRun(run)
    const at = new Date().toISOString()
    const aiReview: AiReviewResult = { verdict: cls.verdict, reason: cls.reason, rule: cls.rule, reviewedAt: at }
    const memoLine = `[AI一次レビュー ${at.slice(0, 16).replace('T', ' ')}] 判定=${cls.verdict} 理由=${cls.reason}（rule=${cls.rule}）`
    const reviewMemo = run.reviewMemo ? `${run.reviewMemo}\n${memoLine}` : memoLine
    const reviewStatus = VERDICT_TO_REVIEW_STATUS[cls.verdict]

    await updateExecutionRunFields(run.runId, {
      reviewStatus,
      reviewMemo,
      aiReview,
      reviewedAt: cls.verdict === 'reviewed' ? at : run.reviewedAt,
    })

    let createdKnowledge = false
    let createdRecommendation = false
    let approvalCreated = false

    if (cls.verdict === 'reviewed') {
      // 既存の Knowledge 生成ループへ流す（Knowledge + Next Epic 候補を自動生成）。
      const loop = await runKnowledgeLoopForRunId(run.runId)
      createdKnowledge = Boolean(loop?.createdKnowledge)
      createdRecommendation = Boolean(loop?.createdRecommendation)
      if (createdKnowledge) knowledgeCreated += 1
    }

    if (cls.verdict === 'needs_human') {
      // 意思決定キュー（Approval）へ。同一 Run の pending が既にあれば二重登録しない。
      const exists = pendingApprovals.some((a) => a.createdRunId === run.runId)
      if (!exists) {
        await createApproval({
          title: `Run一次レビュー: ${run.targetTodoTitle || run.runId}`,
          category: cls.approvalCategory ?? 'multi_option',
          priority: 'normal',
          options: [
            { key: 'mark_reviewed', label: '問題なし（reviewed にする）' },
            { key: 'needs_followup', label: '要フォローアップ（修復・再試行候補へ）' },
            { key: 'keep', label: '保留（現状維持）' },
          ],
          recommended: 'mark_reviewed',
          reason: `AI一次レビュー判定: ${cls.reason}`,
          createdRunId: run.runId,
        })
        approvalCreated = true
        approvalsCreated += 1
      }
    }

    counts[cls.verdict] += 1
    results.push({
      runId: run.runId,
      title: run.targetTodoTitle || run.summary || run.runId,
      verdict: cls.verdict,
      reason: cls.reason,
      rule: cls.rule,
      knowledgeCreated: createdKnowledge,
      recommendationCreated: createdRecommendation,
      approvalCreated,
    })
  }

  const after = await readExecutionRuns()
  const remaining = listNotReviewed(after)
  const result: AiReviewBatchResult = {
    processed: results.length,
    counts,
    results,
    knowledgeCreated,
    approvalsCreated,
    notReviewedRemaining: remaining.length,
    oldestNotReviewedAgeDays: oldestAgeDays(remaining),
    executedAt: new Date().toISOString(),
  }

  await appendAutomationLog({
    event: 'ai_review',
    fallbackReason: `一次レビュー ${result.processed}件処理: reviewed=${counts.reviewed} needs_human=${counts.needs_human} partial=${counts.partial} failed=${counts.failed} / 残not_reviewed=${remaining.length}`,
    aiReviewCounts: {
      processed: result.processed,
      reviewed: counts.reviewed,
      needsHuman: counts.needs_human,
      partial: counts.partial,
      failed: counts.failed,
    },
  })

  return result
}

export interface AiReviewOverview {
  notReviewedCount: number
  oldestNotReviewedAgeDays: number | null
  oldestNotReviewedRunId: string | null
  needsHumanCount: number
  needsFollowupCount: number
  /** 直近 not_reviewed の preview（新しい順）。 */
  preview: Array<{ runId: string; title: string; targetApp: string; startedAt: string; predictedVerdict: AiReviewVerdict }>
}

/** 一次レビュー実行前の状況（件数・最古日齢・判定プレビュー）。書き込みなし。 */
export async function getAiReviewOverview(previewLimit = 10): Promise<AiReviewOverview> {
  const runs = await readExecutionRuns()
  const notReviewed = listNotReviewed(runs)
  const oldest = notReviewed.length > 0
    ? notReviewed.reduce((a, b) => (new Date(a.startedAt).getTime() <= new Date(b.startedAt).getTime() ? a : b))
    : null
  return {
    notReviewedCount: notReviewed.length,
    oldestNotReviewedAgeDays: oldestAgeDays(notReviewed),
    oldestNotReviewedRunId: oldest?.runId ?? null,
    needsHumanCount: runs.filter((r) => r.reviewStatus === 'needs_human').length,
    needsFollowupCount: runs.filter((r) => r.reviewStatus === 'needs_followup').length,
    preview: notReviewed.slice(0, previewLimit).map((r) => ({
      runId: r.runId,
      title: r.targetTodoTitle || r.summary || r.runId,
      targetApp: r.targetApp,
      startedAt: r.startedAt,
      predictedVerdict: classifyRun(r).verdict,
    })),
  }
}
