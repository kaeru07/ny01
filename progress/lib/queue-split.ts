import { readJson } from '@/lib/store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { getEpics, getPendingApprovals } from '@/lib/operations-store'
import { getKnowledgeRecords } from '@/lib/knowledge-loop'
import type { RecommendedEpic } from '@/types/recommended-epic'

// Human Queue / AI Queue 分離（表示用の派生ビュー。新しい正本は作らない）。
// Human: 人間にしかできない判断（公開 / 課金 / 認証 / 本番DB / Goal判断 / 上位候補承認 / needs_human Run）。
// AI: AIが自走してよい作業（run一次レビュー / candidate scoring / orphan修復提案 / failed・partial原因分析 / next epic draft）。

export interface SplitQueueItem {
  id: string
  kind: string
  title: string
  detail: string
  href?: string
  count?: number
}

export interface QueueSplit {
  human: SplitQueueItem[]
  ai: SplitQueueItem[]
}

const HUMAN_CATEGORY_LABEL: Record<string, string> = {
  billing: '課金',
  external_publish: '公開',
  secret: '認証・秘密情報',
  production_risk: '本番DB',
  destructive: '破壊的操作',
  goal_change: 'Goal判断',
  monetization: '収益化判断',
  multi_option: '選択判断',
  executor_fallback: '実行者判断',
}

const OPEN_EPIC_STATUSES = new Set(['proposed', 'approved', 'active', 'in_review', 'paused', 'blocked'])
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

export async function buildQueueSplit(): Promise<QueueSplit> {
  const [runs, epics, approvals, recommendations, knowledge] = await Promise.all([
    readExecutionRuns(),
    getEpics(),
    getPendingApprovals(),
    readJson<RecommendedEpic[]>('recommended-epics.json', []),
    getKnowledgeRecords(),
  ])

  const human: SplitQueueItem[] = []
  const ai: SplitQueueItem[] = []

  // ---- Human Queue ----

  for (const a of approvals) {
    human.push({
      id: `approval-${a.approvalId}`,
      kind: HUMAN_CATEGORY_LABEL[a.category] ?? a.category,
      title: a.title,
      detail: a.reason,
      href: '/approvals',
    })
  }

  // needs_human Run（Approval 未作成のものも漏らさず表示）
  const approvalRunIds = new Set(approvals.map((a) => a.createdRunId).filter(Boolean))
  for (const run of runs.filter((r) => r.reviewStatus === 'needs_human' && !approvalRunIds.has(r.runId))) {
    human.push({
      id: `needs-human-${run.runId}`,
      kind: 'Run判断',
      title: `needs_human: ${run.targetTodoTitle || run.runId}`,
      detail: run.aiReview?.reason ?? run.reviewMemo ?? '人間レビュー待ち',
    })
  }

  // Goal判断（Goal未紐付き Epic）
  const orphanEpics = epics.filter((e) => OPEN_EPIC_STATUSES.has(e.status) && !e.goalId)
  for (const epic of orphanEpics.slice(0, 5)) {
    human.push({
      id: `orphan-${epic.epicId}`,
      kind: 'Goal判断',
      title: `Goal未紐付き: ${epic.title}`,
      detail: 'どのGoalに紐付けるか（または drop するか）を判断する',
      href: `/epic/${epic.epicId}`,
    })
  }

  // 上位候補承認（suggested を priority 順に上位3件だけ人間判断へ）
  const topSuggested = recommendations
    .filter((r) => r.status === 'suggested')
    .sort((a, b) => {
      const p = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      if (p !== 0) return p
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
    .slice(0, 3)
  for (const rec of topSuggested) {
    human.push({
      id: `top-candidate-${rec.id}`,
      kind: '上位候補承認',
      title: rec.title,
      detail: rec.reason,
      href: `/recommended-epics/${rec.id}`,
    })
  }

  // ---- AI Queue ----

  const notReviewed = runs.filter((r) => r.reviewStatus === 'not_reviewed')
  if (notReviewed.length > 0) {
    ai.push({
      id: 'ai-review-batch',
      kind: 'run一次レビュー',
      title: `not_reviewed Run の一次レビュー（${notReviewed.length}件）`,
      detail: `最新: ${notReviewed[0].targetTodoTitle || notReviewed[0].runId}`,
      count: notReviewed.length,
    })
  }

  const suggestedCount = recommendations.filter((r) => r.status === 'suggested').length
  if (suggestedCount > 0) {
    ai.push({
      id: 'candidate-scoring',
      kind: 'candidate scoring',
      title: `suggested 候補のスコアリング・整理（${suggestedCount}件）`,
      detail: '根拠・収益インパクト・工数を付与して上位候補を人間承認に回す',
      href: '/recommended-epics',
      count: suggestedCount,
    })
  }

  if (orphanEpics.length > 0) {
    ai.push({
      id: 'orphan-repair',
      kind: 'orphan修復提案',
      title: `Goal未紐付きEpicの修復提案（${orphanEpics.length}件）`,
      detail: orphanEpics.map((e) => e.title).slice(0, 3).join(' / '),
      count: orphanEpics.length,
    })
  }

  const failedOrPartial = runs.filter(
    (r) => (r.runStatus === 'failed' || r.runStatus === 'partial') && r.reviewStatus !== 'reviewed',
  )
  if (failedOrPartial.length > 0) {
    ai.push({
      id: 'failed-partial-analysis',
      kind: 'failed/partial原因分析',
      title: `failed / partial Run の原因分析・再試行判断（${failedOrPartial.length}件）`,
      detail: failedOrPartial.slice(0, 3).map((r) => `${r.runId}(${r.runStatus})`).join(' / '),
      count: failedOrPartial.length,
    })
  }

  const knowledgeWithoutNextEpic = knowledge.filter((k) => !k.nextEpicCandidateId)
  if (knowledgeWithoutNextEpic.length > 0) {
    ai.push({
      id: 'next-epic-draft',
      kind: 'next epic draft作成',
      title: `Knowledge から Next Epic 候補の draft 作成（${knowledgeWithoutNextEpic.length}件）`,
      detail: knowledgeWithoutNextEpic.slice(0, 2).map((k) => k.title).join(' / '),
      count: knowledgeWithoutNextEpic.length,
    })
  }

  return { human, ai }
}
