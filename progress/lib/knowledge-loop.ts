import fs from 'fs/promises'
import path from 'path'
import { readJson, writeJson } from '@/lib/store'
import { getEpic, getEpics } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import type { ExecutionRun } from '@/types/execution-run'
import type { RecommendedEpic } from '@/types/recommended-epic'
import type {
  KnowledgeLoopResult,
  KnowledgeRecord,
  LoopClosureGap,
  LoopClosureReport,
  LoopHandoffStat,
  LoopHealResult,
  LoopMetricBreakdown,
  LoopPendingCandidate,
  LoopPendingGroup,
} from '@/types/knowledge'

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 }

const KNOWLEDGE_FILE = 'knowledge-records.json'
const RECOMMENDATIONS_FILE = 'recommended-epics.json'
const DECISION_LOG_PATH = path.join(process.cwd(), '..', '..', '..', 'pm', 'decision-log.md')
const VAULT_REVIEWS_DIR = path.join(process.cwd(), '..', '..', '..', 'obsidian-sync-vault', '20_reviews')
const VAULT_RESEARCH_DIR = path.join(process.cwd(), '..', '..', '..', 'obsidian-sync-vault', '06_research')

function nowIso(): string {
  return new Date().toISOString()
}

function ymd(date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

function safeSlug(input: string): string {
  const ascii = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
  if (ascii) return ascii
  return Buffer.from(input).toString('hex').slice(0, 32) || 'knowledge'
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- なし'
}

function firstLines(text: string, limit: number): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
}

function inferLearnings(run: ExecutionRun): string[] {
  const lines = [
    run.summary,
    ...run.warnings.map((w) => `注意: ${w}`),
    ...run.errors.map((e) => `エラー: ${e}`),
    ...firstLines(run.rawReport, 4),
  ].filter((line) => line && line.trim())
  const unique: string[] = []
  for (const line of lines) {
    if (!unique.includes(line)) unique.push(line)
    if (unique.length >= 8) break
  }
  return unique
}

function inferDoneCriteria(run: ExecutionRun): string[] {
  const next = run.nextActions.filter((a) => a && a.trim())
  if (next.length > 0) return next.slice(0, 6)
  if (run.warnings.length > 0) return run.warnings.slice(0, 4).map((w) => `未対応点を解消する: ${w}`)
  return [
    'review済みExecutionRunの学びを反映した改善が完了している',
    'build / typecheck / lint のいずれかが実行され結果が記録されている',
    '変更内容と次アクションがExecutionRunまたはレビュー履歴に保存されている',
  ]
}

function inferGoalId(run: ExecutionRun, epicGoalId?: string): string {
  if (epicGoalId) return epicGoalId
  const text = `${run.targetApp} ${run.targetTodoTitle} ${run.summary} ${run.rawReport}`.toLowerCase()
  if (text.includes('review') || text.includes('knowledge') || text.includes('executionrun') || text.includes('resume')) {
    return 'goal-execution-review-loop'
  }
  if (text.includes('codex') || text.includes('claude') || text.includes('approval') || text.includes('risk')) {
    return 'goal-ai-executor-ops'
  }
  if (text.includes('news') || text.includes('mahjong') || text.includes('netscope') || text.includes('monetization') || text.includes('birdlog') || text.includes('anglerlog')) {
    return 'goal-value-validation-pipeline'
  }
  return 'goal-ai-factory-os'
}

async function readKnowledge(): Promise<KnowledgeRecord[]> {
  return readJson<KnowledgeRecord[]>(KNOWLEDGE_FILE, [])
}

async function writeKnowledge(records: KnowledgeRecord[]): Promise<void> {
  await writeJson(KNOWLEDGE_FILE, records)
}

async function writeVaultKnowledge(run: ExecutionRun, knowledge: KnowledgeRecord): Promise<void> {
  const reviewAbs = path.join(VAULT_REVIEWS_DIR, path.basename(knowledge.vaultReviewPath))
  const researchAbs = path.join(VAULT_RESEARCH_DIR, path.basename(knowledge.researchPath))
  const reviewMd = [
    `# ${knowledge.title}`,
    '',
    `- knowledgeId: ${knowledge.id}`,
    `- sourceRunId: ${knowledge.sourceRunId}`,
    `- sourceEpicId: ${knowledge.sourceEpicId ?? ''}`,
    `- goalId: ${knowledge.goalId ?? ''}`,
    `- targetApp: ${run.targetApp}`,
    `- reviewedAt: ${run.reviewedAt ?? ''}`,
    '',
    '## Summary',
    knowledge.summary,
    '',
    '## Learnings',
    bulletList(knowledge.learnings),
    '',
    '## Next Actions',
    bulletList(knowledge.nextActions),
    '',
    '## Changed Files',
    bulletList(knowledge.changedFiles),
    '',
    '## Raw Review Memo',
    run.reviewMemo || 'なし',
    '',
  ].join('\n')
  const researchMd = [
    `# ${knowledge.title}`,
    '',
    'type: knowledge',
    `sourceRunId: ${knowledge.sourceRunId}`,
    `sourceKnowledgeId: ${knowledge.id}`,
    `goalId: ${knowledge.goalId ?? ''}`,
    '',
    '## Research / Knowledge',
    knowledge.summary,
    '',
    '## Extracted Learnings',
    bulletList(knowledge.learnings),
    '',
    '## Next Epic Seed',
    bulletList(knowledge.nextActions),
    '',
  ].join('\n')
  await fs.mkdir(VAULT_REVIEWS_DIR, { recursive: true })
  await fs.mkdir(VAULT_RESEARCH_DIR, { recursive: true })
  await fs.writeFile(reviewAbs, reviewMd, 'utf-8')
  await fs.writeFile(researchAbs, researchMd, 'utf-8')
}

async function appendDecisionLog(run: ExecutionRun, knowledge: KnowledgeRecord): Promise<void> {
  const entry = [
    '',
    '---',
    '',
    `### [${ymd()}] Knowledge生成: ${knowledge.title}`,
    '',
    `**決定**: reviewed ExecutionRun \`${run.runId}\` から Knowledge \`${knowledge.id}\` を生成し、Next Epic候補の種として保存した。`,
    '',
    `**理由**: Reviewで終わらせず、Knowledge化と次Epic候補生成までつなげるAI工場v2 Phase2ループを閉じるため。`,
    '',
    `**影響するGoal**: ${knowledge.goalId ?? '未設定'}`,
    '',
    `**影響するEpic**: ${knowledge.sourceEpicId ?? '未設定'}`,
    '',
    `**レビュー結果**: ${knowledge.summary}`,
    '',
  ].join('\n')
  await fs.mkdir(path.dirname(DECISION_LOG_PATH), { recursive: true })
  await fs.appendFile(DECISION_LOG_PATH, entry, 'utf-8')
}

function buildRecommendation(run: ExecutionRun, knowledge: KnowledgeRecord): RecommendedEpic {
  const ts = nowIso()
  const id = `rec-knowledge-${safeSlug(run.runId)}`
  const doneCriteria = inferDoneCriteria(run)
  return {
    id,
    status: 'suggested',
    kind: knowledge.sourceEpicId ? 'existing_epic_next_action' : 'new_epic',
    title: `レビュー起点: ${run.targetTodoTitle || run.summary || run.runId} の次Epic候補`,
    reason: `reviewed ExecutionRun ${run.runId} からKnowledge ${knowledge.id}を生成。レビューで得た学びを次の作業候補へ変換する。`,
    monetizationImpact: knowledge.goalId === 'goal-value-validation-pipeline' ? 'medium' : 'none',
    targetApp: run.targetApp,
    relatedEpicId: knowledge.sourceEpicId,
    relatedVault: [knowledge.vaultReviewPath, knowledge.researchPath],
    relatedRunIds: [run.runId],
    priority: 'P1',
    doneCriteria,
    decisionPolicy: 'autonomous',
    riskFlags: [],
    preferredExecutor: run.preferredExecutor ?? 'claude',
    fallbackExecutor: run.fallbackExecutor ?? 'codex',
    sourceKind: 'review_knowledge',
    sourceRef: knowledge.id,
    goalId: knowledge.goalId,
    parentEpicId: knowledge.sourceEpicId,
    sourceRunId: run.runId,
    sourceKnowledgeId: knowledge.id,
    duplicate: { duplicate: false },
    factoryEligiblePreview: { eligible: true, reasons: [], classification: 'auto', factoryManaged: true },
    notes: `Review→Knowledge→Next Epic ループで自動生成。sourceRunId=${run.runId} sourceKnowledgeId=${knowledge.id}`,
    history: [{ at: ts, action: 'suggested', detail: `reviewed run ${run.runId} から自動生成` }],
    createdAt: ts,
    updatedAt: ts,
  }
}

function followupReason(run: ExecutionRun): string {
  const target = run.targetTodoTitle || run.summary || run.runId
  const fix = run.fixPrompt ? `人間の修正指示: ${run.fixPrompt.slice(0, 500)} ` : ''
  const memo = run.reviewMemo ? ` レビュー指摘: ${run.reviewMemo}` : ''
  const error = run.errors?.[0] ? ` エラー: ${run.errors[0]}` : ''
  return `${fix}修正依頼（元作業: ${target} / runId ${run.runId}）をAI工場の作業候補へ戻す。${memo}${error}`.trim()
}

function followupDoneCriteria(run: ExecutionRun): string[] {
  const criteria = [
    ...(run.fixPrompt ? [`人間の修正指示を満たす: ${run.fixPrompt.slice(0, 300)}`] : []),
    ...(run.nextActions ?? []).filter((a) => typeof a === 'string' && a.trim()),
    ...(run.errors ?? []).slice(0, 2).map((e) => `元Runのエラーを解消する: ${e}`),
    ...(run.reviewMemo ? [`レビュー指摘を反映する: ${run.reviewMemo}`] : []),
  ]
  const unique = Array.from(new Set(criteria.map((c) => c.trim()).filter(Boolean)))
  return unique.length > 0
    ? unique.slice(0, 6)
    : [
        '修正依頼された箇所を再確認し、必要な修正を実施する',
        'build / typecheck / lint のいずれかが実行され結果が記録されている',
        '修正結果をExecutionRunに記録し、人間が再確認できる状態にする',
  ]
}

function followupNotes(run: ExecutionRun): string {
  const base = `修正依頼の閉ループで自動生成。followupOfRunId=${run.runId}`
  if (!run.fixPrompt) return base
  return `${base}\n\n人間の修正指示:\n${run.fixPrompt.slice(0, 2000)}`
}

function buildFollowupRecommendation(run: ExecutionRun, epicGoalId?: string): RecommendedEpic {
  const ts = nowIso()
  const id = `rec-followup-${safeSlug(run.runId)}`
  const sourceEpicId = run.epicId
  return {
    id,
    status: 'suggested',
    kind: sourceEpicId ? 'existing_epic_next_action' : 'new_epic',
    title: `修正依頼: ${run.targetTodoTitle || run.summary || run.runId}`,
    reason: followupReason(run),
    monetizationImpact: 'none',
    targetApp: run.targetApp,
    relatedEpicId: sourceEpicId,
    relatedRunIds: [run.runId],
    priority: 'P1',
    doneCriteria: followupDoneCriteria(run),
    decisionPolicy: 'autonomous',
    riskFlags: [],
    preferredExecutor: run.preferredExecutor ?? 'claude',
    fallbackExecutor: run.fallbackExecutor ?? 'codex',
    sourceKind: 'review_followup',
    sourceRef: `followup:${run.runId}`,
    goalId: inferGoalId(run, epicGoalId),
    parentEpicId: sourceEpicId,
    sourceRunId: run.runId,
    followupOfRunId: run.runId,
    duplicate: { duplicate: false },
    factoryEligiblePreview: { eligible: true, reasons: [], classification: 'auto', factoryManaged: true },
    notes: followupNotes(run),
    history: [{ at: ts, action: 'suggested', detail: `needs_followup run ${run.runId} から自動生成` }],
    createdAt: ts,
    updatedAt: ts,
  }
}

export async function generateFollowupRecommendationForRun(run: ExecutionRun): Promise<{ id: string; created: boolean } | null> {
  if (run.reviewStatus !== 'needs_followup') return null
  const list = await readJson<RecommendedEpic[]>(RECOMMENDATIONS_FILE, [])
  const epic = run.epicId ? await getEpic(run.epicId) : null
  const existingIndex = list.findIndex((r) => r.followupOfRunId === run.runId || (r.sourceKind === 'review_followup' && r.sourceRunId === run.runId))
  if (existingIndex >= 0) {
    const existing = list[existingIndex]
    const nextDoneCriteria = followupDoneCriteria(run)
    list[existingIndex] = {
      ...existing,
      reason: followupReason(run),
      doneCriteria: nextDoneCriteria,
      notes: followupNotes(run),
      goalId: existing.goalId ?? inferGoalId(run, epic?.goalId),
      updatedAt: nowIso(),
      history: [
        ...(existing.history ?? []),
        { at: nowIso(), action: 'fix_prompt_updated', detail: run.fixPrompt ? '人間の修正指示を反映' : '修正依頼候補を再同期' },
      ],
    }
    await writeJson(RECOMMENDATIONS_FILE, list)
    return { id: existing.id, created: false }
  }
  const rec = buildFollowupRecommendation(run, epic?.goalId)
  list.push(rec)
  await writeJson(RECOMMENDATIONS_FILE, list)
  return { id: rec.id, created: true }
}

export async function backfillFollowupRecommendations(): Promise<{ processed: number; createdRecommendations: number }> {
  const runs = await readExecutionRuns()
  let processed = 0
  let createdRecommendations = 0
  for (const run of runs.filter((r) => r.reviewStatus === 'needs_followup')) {
    const result = await generateFollowupRecommendationForRun(run)
    if (!result) continue
    processed += 1
    if (result.created) createdRecommendations += 1
  }
  return { processed, createdRecommendations }
}

async function upsertRecommendation(run: ExecutionRun, knowledge: KnowledgeRecord): Promise<{ id: string; created: boolean }> {
  const list = await readJson<RecommendedEpic[]>(RECOMMENDATIONS_FILE, [])
  const existing = list.find((r) => r.sourceKind === 'review_knowledge' && r.sourceRunId === run.runId)
  if (existing) return { id: existing.id, created: false }
  const rec = buildRecommendation(run, knowledge)
  list.push(rec)
  await writeJson(RECOMMENDATIONS_FILE, list)
  return { id: rec.id, created: true }
}

export async function runKnowledgeLoopForReviewedRun(run: ExecutionRun): Promise<KnowledgeLoopResult | null> {
  if (run.reviewStatus !== 'reviewed') return null
  const records = await readKnowledge()
  const existing = records.find((k) => k.sourceRunId === run.runId)
  if (existing?.nextEpicCandidateId) {
    return {
      knowledge: existing,
      recommendationId: existing.nextEpicCandidateId,
      createdKnowledge: false,
      createdRecommendation: false,
    }
  }

  const epic = run.epicId ? await getEpic(run.epicId) : null
  const ts = nowIso()
  const id = existing?.id ?? `know-${safeSlug(run.runId)}`
  const reviewPath = `20_reviews/${ymd()}_${id}.md`
  const researchPath = `06_research/${ymd()}_${id}.md`
  const knowledge: KnowledgeRecord = existing ?? {
    id,
    sourceRunId: run.runId,
    sourceEpicId: run.epicId,
    goalId: inferGoalId(run, epic?.goalId),
    title: `Review Knowledge: ${run.targetTodoTitle || run.runId}`,
    summary: run.reviewMemo || run.summary || run.rawReport || 'review済みExecutionRunから生成',
    learnings: inferLearnings(run),
    nextActions: inferDoneCriteria(run),
    changedFiles: run.changedFiles.map((f) => f.change ? `${f.file}: ${f.change}` : f.file),
    vaultReviewPath: reviewPath,
    researchPath,
    decisionLogPath: 'pm/decision-log.md',
    createdAt: ts,
    updatedAt: ts,
  }

  if (!existing) {
    records.push(knowledge)
    await writeVaultKnowledge(run, knowledge)
    await appendDecisionLog(run, knowledge)
  }

  const rec = await upsertRecommendation(run, knowledge)
  knowledge.nextEpicCandidateId = rec.id
  knowledge.updatedAt = nowIso()
  const idx = records.findIndex((k) => k.id === knowledge.id)
  if (idx >= 0) records[idx] = knowledge
  else records.push(knowledge)
  await writeKnowledge(records)

  return {
    knowledge,
    recommendationId: rec.id,
    createdKnowledge: !existing,
    createdRecommendation: rec.created,
  }
}

export async function runKnowledgeLoopForRunId(runId: string): Promise<KnowledgeLoopResult | null> {
  const runs = await readExecutionRuns()
  const run = runs.find((r) => r.runId === runId)
  if (!run) return null
  return runKnowledgeLoopForReviewedRun(run)
}

export async function getReviewGeneratedRecommendations(): Promise<RecommendedEpic[]> {
  const list = await readJson<RecommendedEpic[]>(RECOMMENDATIONS_FILE, [])
  return list
    .filter((r) => r.sourceKind === 'review_knowledge')
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export async function getKnowledgeRecords(): Promise<KnowledgeRecord[]> {
  return readKnowledge()
}

/**
 * Execution→Review→Knowledge→Next Epic ループが閉じているかを測定する（書き込みなし）。
 * - reviewed Run なのに Knowledge が無い
 * - Knowledge なのに Next Epic 候補(nextEpicCandidateId)が無い
 * - needs_followup Run なのに修正候補(review_followup)が無い
 * を「こぼれ」として列挙する。gap が 0 ならループは閉じている。
 *
 * 対象 Run は backfill と同じ条件（epicId が空、または実在する Epic）に揃え、
 * heal（既存 backfill）で必ず解消できる gap だけを数える。
 */
/**
 * closedLoopRate（実測の閉ループ率）と、まだ閉じていない Run の内訳を組み立てる。
 * 分母・分子は factory-metrics.computeFactoryMetrics と同じ定義に揃える
 * （countableRuns = runStatus !== 'running' / closedLoopRuns = Knowledge を持つ Run）。
 * gaps が 0（こぼれなし）でも、一次レビュー待ち等で率が 100% にならない理由を説明する。
 */
function buildLoopMetricBreakdown(runs: ExecutionRun[], knowledge: KnowledgeRecord[]): LoopMetricBreakdown {
  const knowledgeRunIds = new Set(knowledge.map((k) => k.sourceRunId))
  const countable = runs.filter((r) => r.runStatus !== 'running')
  const closedLoopRuns = countable.filter((r) => knowledgeRunIds.has(r.runId)).length
  const open = countable.filter((r) => !knowledgeRunIds.has(r.runId))
  const closedLoopRate = countable.length > 0 ? closedLoopRuns / countable.length : 0

  const awaitingFirstReview = open.filter((r) => !r.reviewStatus || r.reviewStatus === 'not_reviewed').length
  const blockedOnHuman = open.filter((r) => r.reviewStatus === 'needs_human').length
  const awaitingFix = open.filter((r) => r.reviewStatus === 'needs_followup').length
  const other = open.length - awaitingFirstReview - blockedOnHuman - awaitingFix

  const nextActionsToRaise: string[] = []
  if (awaitingFirstReview > 0) {
    nextActionsToRaise.push(`一次レビュー待ち ${awaitingFirstReview} 件。/inbox でレビューすると自動でKnowledge化され、率が上がります。`)
  }
  if (awaitingFix > 0) {
    nextActionsToRaise.push(`修正依頼 ${awaitingFix} 件。修正候補は生成済み。修正Runをレビューすると閉ループになります。`)
  }
  if (blockedOnHuman > 0) {
    nextActionsToRaise.push(`人間判断待ち ${blockedOnHuman} 件。承認・判断を入れると次へ進みます。`)
  }
  if (other > 0) {
    nextActionsToRaise.push(`未補完 ${other} 件。「こぼれを自己修復」で閉じられます。`)
  }
  if (nextActionsToRaise.length === 0) {
    nextActionsToRaise.push('すべて閉ループです。')
  }

  return {
    closedLoopRate,
    closedLoopRatePct: Math.round(closedLoopRate * 1000) / 10,
    countableRuns: countable.length,
    closedLoopRuns,
    openLoopRuns: open.length,
    openBreakdown: { awaitingFirstReview, blockedOnHuman, awaitingFix, other },
    nextActionsToRaise,
  }
}

/**
 * ループ最終リンク（Next Epic候補 → Epic化/トリアージ）の受け渡し状況を組み立てる。
 * レビュー起点候補（review_knowledge / review_followup）が suggested のまま滞留すると、
 * 候補が次の実行へ戻らずループは実務上閉じない。これを「人間トリアージ待ち」として可視化する。
 * suggested 滞留は自己修復で解消できる『こぼれ(gap)』ではないため closed 判定には含めない。
 */
function buildLoopHandoffStat(recommendations: RecommendedEpic[]): LoopHandoffStat {
  const reviewCandidates = recommendations.filter(
    (r) => r.sourceKind === 'review_knowledge' || r.sourceKind === 'review_followup',
  )
  const total = reviewCandidates.length
  const pending = reviewCandidates.filter((r) => r.status === 'suggested')
  const pendingTriage = pending.length
  const promoted = reviewCandidates.filter((r) => r.status === 'epic_created').length
  const actedOn = total - pendingTriage
  const handoffRate = total > 0 ? actedOn / total : 0

  // 滞留候補を priority（P0→P2）→ updatedAt 新しい順 で並べ、次に着手すべき上位5件を要約する。
  // 件数だけの指標を「具体的にどれを次の実行へ戻すか」の導線に変えるため。
  const topPendingCandidates: LoopPendingCandidate[] = [...pending]
    .sort((a, b) => {
      const pa = PRIORITY_RANK[a.priority] ?? 9
      const pb = PRIORITY_RANK[b.priority] ?? 9
      if (pa !== pb) return pa - pb
      return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
    })
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title,
      priority: r.priority,
      targetApp: r.targetApp,
      sourceKind: r.sourceKind ?? '',
      sourceRunId: r.sourceRunId,
      updatedAt: r.updatedAt,
    }))

  // 滞留候補を案件単位に集約する。同一案件への修正依頼は run ごとに別候補として生成されるため、
  // 生件数（pendingTriage）はトリアージ負荷を過大に見せる。groupKey で束ねて「1 issue = 1 判断」に直す。
  const groups = new Map<string, RecommendedEpic[]>()
  for (const r of pending) {
    const key = pendingGroupKey(r)
    const bucket = groups.get(key)
    if (bucket) bucket.push(r)
    else groups.set(key, [r])
  }
  const consolidatedPending: LoopPendingGroup[] = Array.from(groups.entries())
    .map(([groupKey, members]) => {
      const sorted = [...members].sort((a, b) => {
        const pa = PRIORITY_RANK[a.priority] ?? 9
        const pb = PRIORITY_RANK[b.priority] ?? 9
        if (pa !== pb) return pa - pb
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      })
      const rep = sorted[0]
      return {
        groupKey,
        title: rep.title,
        priority: rep.priority,
        targetApp: rep.targetApp,
        sourceKind: rep.sourceKind ?? '',
        count: members.length,
        representativeId: rep.id,
        candidateIds: sorted.map((m) => m.id),
        latestUpdatedAt: sorted[0].updatedAt,
      }
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      const pa = PRIORITY_RANK[a.priority] ?? 9
      const pb = PRIORITY_RANK[b.priority] ?? 9
      if (pa !== pb) return pa - pb
      return (b.latestUpdatedAt ?? '').localeCompare(a.latestUpdatedAt ?? '')
    })
  const distinctPendingIssues = consolidatedPending.length

  const nextAction =
    total === 0
      ? 'レビュー起点の次Epic候補はまだありません。'
      : pendingTriage > 0
        ? distinctPendingIssues < pendingTriage
          ? `未トリアージ ${pendingTriage} 件は実質 ${distinctPendingIssues} 案件（重複あり）。/recommended-epics で案件ごとにまとめて承認/Epic化/保留を選ぶと、候補が次の実行へ戻りループが閉じます。`
          : `未トリアージの候補 ${pendingTriage} 件。/recommended-epics で承認/Epic化/保留を選ぶと、候補が次の実行へ戻りループが閉じます。`
        : 'すべての候補がトリアージ済みです。'

  return {
    reviewCandidatesTotal: total,
    reviewCandidatesActedOn: actedOn,
    reviewCandidatesPromoted: promoted,
    reviewCandidatesPendingTriage: pendingTriage,
    handoffRatePct: Math.round(handoffRate * 1000) / 10,
    nextAction,
    topPendingCandidates,
    distinctPendingIssues,
    consolidatedPending: consolidatedPending.slice(0, 5),
  }
}

/**
 * 滞留候補を「同一案件」に束ねるためのキーを導出する。
 * 親Epic（parentEpicId / relatedEpicId）が同じものは同案件。無ければ targetApp + 正規化タイトルで束ねる。
 * 正規化: 先頭の種別ラベル（修正依頼: / レビュー起点:）を除去し、run-id 風の数字列・空白差を吸収する。
 */
function pendingGroupKey(r: RecommendedEpic): string {
  const epicRef = r.parentEpicId ?? r.relatedEpicId
  if (epicRef) return `epic:${epicRef}`
  const app = (r.targetApp ?? '').toLowerCase().trim()
  const normalizedTitle = (r.title ?? '')
    .replace(/^\s*(修正依頼|レビュー起点)\s*[:：]\s*/, '')
    .replace(/\b\d{8}-\d{6}\b/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
  return `${r.sourceKind ?? ''}|${app}|${normalizedTitle}`
}

export async function getLoopClosureReport(): Promise<LoopClosureReport> {
  const [runs, knowledge, recommendations, epics] = await Promise.all([
    readExecutionRuns(),
    readKnowledge(),
    readJson<RecommendedEpic[]>(RECOMMENDATIONS_FILE, []),
    getEpics(),
  ])
  const epicIds = new Set(epics.map((e) => e.epicId))
  const healable = (run: ExecutionRun): boolean => !run.epicId || epicIds.has(run.epicId)

  const reviewStatusCounts: Record<string, number> = {}
  for (const run of runs) {
    const key = run.reviewStatus ?? 'undefined'
    reviewStatusCounts[key] = (reviewStatusCounts[key] ?? 0) + 1
  }

  const knowledgeByRun = new Set(knowledge.map((k) => k.sourceRunId))
  const followupByRun = new Set(
    recommendations
      .filter((r) => r.sourceKind === 'review_followup' && r.sourceRunId)
      .map((r) => r.sourceRunId),
  )

  const reviewedRuns = runs.filter((r) => r.reviewStatus === 'reviewed' && healable(r))
  const needsFollowupRuns = runs.filter((r) => r.reviewStatus === 'needs_followup' && healable(r))

  const gaps: LoopClosureGap[] = []
  for (const run of reviewedRuns) {
    if (!knowledgeByRun.has(run.runId)) {
      gaps.push({
        kind: 'reviewed_without_knowledge',
        runId: run.runId,
        detail: `reviewed Run ${run.runId}（${run.targetTodoTitle || run.summary || ''}）に Knowledge が未生成。`,
      })
    }
  }
  for (const k of knowledge) {
    if (!k.nextEpicCandidateId) {
      gaps.push({
        kind: 'knowledge_without_next_epic',
        knowledgeId: k.id,
        runId: k.sourceRunId,
        detail: `Knowledge ${k.id}（run ${k.sourceRunId}）に Next Epic 候補が未紐付け。`,
      })
    }
  }
  for (const run of needsFollowupRuns) {
    if (!followupByRun.has(run.runId)) {
      gaps.push({
        kind: 'needs_followup_without_recommendation',
        runId: run.runId,
        detail: `needs_followup Run ${run.runId}（${run.targetTodoTitle || run.summary || ''}）に修正候補が未生成。`,
      })
    }
  }

  // 参照整合チェック（gaps とは別枠・closed 判定に含めない）:
  // nextEpicCandidateId は入っているが、指す先の候補が recommended-epics に存在しない
  // 「リンク切れ」を数える。gap 判定（!nextEpicCandidateId）は ID が空かしか見ないため、
  // このリンク切れは素通りしてどの画面にも出ない。件数の可視化のみ行い、再生成はしない。
  const recIds = new Set(recommendations.map((r) => r.id))
  const brokenKnowledge = knowledge.filter(
    (k) => k.nextEpicCandidateId && !recIds.has(k.nextEpicCandidateId),
  )

  return {
    closed: gaps.length === 0,
    generatedAt: nowIso(),
    reviewStatusCounts,
    metric: buildLoopMetricBreakdown(runs, knowledge),
    handoff: buildLoopHandoffStat(recommendations),
    stage: {
      reviewedRuns: reviewedRuns.length,
      knowledgeRecords: knowledge.length,
      knowledgeWithNextEpic: knowledge.filter((k) => k.nextEpicCandidateId).length,
      needsFollowupRuns: needsFollowupRuns.length,
      followupRecommendations: recommendations.filter((r) => r.sourceKind === 'review_followup').length,
      reviewKnowledgeRecommendations: recommendations.filter((r) => r.sourceKind === 'review_knowledge').length,
    },
    gaps,
    gapCount: gaps.length,
    referenceIntegrity: {
      brokenNextEpicCandidates: brokenKnowledge.length,
      brokenKnowledgeIds: brokenKnowledge.map((k) => k.id).slice(0, 50),
    },
  }
}

/**
 * ループのこぼれを既存 backfill（冪等）で自己修復する。
 * reviewed→Knowledge/Next Epic と needs_followup→修正候補 の両方を補完し、前後レポートを返す。
 */
export async function healLoopClosure(): Promise<LoopHealResult> {
  const before = await getLoopClosureReport()
  const [reviewedLoop, followup] = await Promise.all([
    backfillReviewedKnowledgeLoop(),
    backfillFollowupRecommendations(),
  ])
  const after = await getLoopClosureReport()
  return {
    before,
    after,
    healed: Math.max(0, before.gapCount - after.gapCount),
    createdKnowledgeRecommendations: reviewedLoop.createdRecommendations,
    createdFollowupRecommendations: followup.createdRecommendations,
  }
}

export async function backfillReviewedKnowledgeLoop(): Promise<{ processed: number; createdRecommendations: number }> {
  const runs = await readExecutionRuns()
  const epics = await getEpics()
  const epicIds = new Set(epics.map((e) => e.epicId))
  let processed = 0
  let createdRecommendations = 0
  for (const run of runs.filter((r) => r.reviewStatus === 'reviewed' && (!r.epicId || epicIds.has(r.epicId)))) {
    const result = await runKnowledgeLoopForReviewedRun(run)
    if (!result) continue
    processed += 1
    if (result.createdRecommendation) createdRecommendations += 1
  }
  return { processed, createdRecommendations }
}
