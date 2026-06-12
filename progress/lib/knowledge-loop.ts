import fs from 'fs/promises'
import path from 'path'
import { readJson, writeJson } from '@/lib/store'
import { getEpic, getEpics } from '@/lib/operations-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import type { ExecutionRun } from '@/types/execution-run'
import type { RecommendedEpic } from '@/types/recommended-epic'
import type { KnowledgeLoopResult, KnowledgeRecord } from '@/types/knowledge'

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
  const memo = run.reviewMemo ? ` レビュー指摘: ${run.reviewMemo}` : ''
  const error = run.errors?.[0] ? ` エラー: ${run.errors[0]}` : ''
  return `修正依頼（元作業: ${target} / runId ${run.runId}）をAI工場の作業候補へ戻す。${memo}${error}`.trim()
}

function followupDoneCriteria(run: ExecutionRun): string[] {
  const criteria = [
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
    notes: `修正依頼の閉ループで自動生成。followupOfRunId=${run.runId}`,
    history: [{ at: ts, action: 'suggested', detail: `needs_followup run ${run.runId} から自動生成` }],
    createdAt: ts,
    updatedAt: ts,
  }
}

export async function generateFollowupRecommendationForRun(run: ExecutionRun): Promise<{ id: string; created: boolean } | null> {
  if (run.reviewStatus !== 'needs_followup') return null
  const list = await readJson<RecommendedEpic[]>(RECOMMENDATIONS_FILE, [])
  const existing = list.find((r) => r.followupOfRunId === run.runId || (r.sourceKind === 'review_followup' && r.sourceRunId === run.runId))
  if (existing) return { id: existing.id, created: false }
  const epic = run.epicId ? await getEpic(run.epicId) : null
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
