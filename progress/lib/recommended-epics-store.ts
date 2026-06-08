import { readJson, writeJson } from '@/lib/store'
import { getEpics, createEpic, updateEpic } from '@/lib/operations-store'
import { getCandidates } from '@/lib/monetization-store'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { validateEpicContract, evaluateFactoryEligibility } from '@/lib/epic-contract'
import { addExecutionRun } from '@/lib/execution-run-writer'
import type { ExecutionRun } from '@/types/execution-run'
import type { EpicRiskFlag } from '@/lib/types/operations'
import type {
  RecommendedEpic,
  RecommendationStatus,
  RecHistoryEntry,
  DuplicateCheck,
  ApproveRecommendationResult,
  MonetizationImpact,
} from '@/types/recommended-epic'

// おすすめ追加Epic のデータアクセス + 抽出ロジック + 承認(Epic追加)。
// data/real/recommended-epics.json を正本とする。自動Epic追加は禁止（approve は人間操作のみ）。
// 既存 Factory の安全ゲートは緩めない（riskFlags は素通しせず eligibility に反映するだけ）。

const FILE = 'recommended-epics.json'

const EXISTING_APP_SLUGS = [
  'progress', 'goalplanner', 'goal-planner', 'netscope', 'mahjong', 'nanikiru',
  'nanikirushorts', 'shogi', 'shogitrainer', 'news', 'newsapp', 'scrapelab', 'scrape-lab',
]

const IMPACT_ORDER: Record<MonetizationImpact, number> = { high: 0, medium: 1, low: 2, none: 3 }

function now(): string {
  return new Date().toISOString()
}

function slugify(input: string): string {
  return (input.match(/[A-Za-z0-9]+/g) ?? []).join('').toLowerCase()
}

function genRunId(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function dedupeKey(kind: string, ref?: string): string {
  return `${kind}:${ref ?? ''}`
}

function impactFromRevenue(rev?: string, score?: number): MonetizationImpact {
  if (rev) {
    const r = rev.toUpperCase()
    if (r.includes('S') || r.includes('A')) return 'high'
    if (r.includes('B')) return 'medium'
    if (r.includes('C')) return 'low'
  }
  if (typeof score === 'number') {
    if (score >= 80) return 'high'
    if (score >= 65) return 'medium'
    return 'low'
  }
  return 'none'
}

export async function getRecommendations(): Promise<RecommendedEpic[]> {
  const list = await readJson<RecommendedEpic[]>(FILE, [])
  return [...list].sort(
    (a, b) =>
      (IMPACT_ORDER[a.monetizationImpact] ?? 9) - (IMPACT_ORDER[b.monetizationImpact] ?? 9) ||
      (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )
}

export async function getRecommendation(id: string): Promise<RecommendedEpic | null> {
  const list = await readJson<RecommendedEpic[]>(FILE, [])
  return list.find((r) => r.id === id) ?? null
}

export async function updateRecommendation(
  id: string,
  patch: Partial<RecommendedEpic>,
): Promise<RecommendedEpic | null> {
  const list = await readJson<RecommendedEpic[]>(FILE, [])
  const idx = list.findIndex((r) => r.id === id)
  if (idx === -1) return null
  list[idx] = { ...list[idx], ...patch, id: list[idx].id, createdAt: list[idx].createdAt, updatedAt: now() }
  await writeJson(FILE, list)
  return list[idx]
}

export async function changeStatus(
  id: string,
  status: RecommendationStatus,
  detail?: string,
): Promise<RecommendedEpic | null> {
  const r = await getRecommendation(id)
  if (!r) return null
  const history: RecHistoryEntry[] = [...(r.history ?? []), { at: now(), action: `status:${status}`, detail }]
  return updateRecommendation(id, { status, history })
}

/** 既存 Epic / 実装済みアプリ / 既存おすすめ(epic_created) との重複チェック。 */
async function checkDuplicateBySlug(slug: string): Promise<DuplicateCheck> {
  if (!slug) return { duplicate: false }
  if (EXISTING_APP_SLUGS.includes(slug)) {
    return { duplicate: true, reason: `実装済み/進行中アプリと重複: ${slug}` }
  }
  const epics = await getEpics()
  for (const e of epics) {
    const hay = [e.title ?? '', e.epicId ?? '', ...(e.targetApps ?? [])].map((s) => slugify(s)).join(' ')
    if (slug.length >= 3 && hay.includes(slug)) {
      return { duplicate: true, reason: `既存 Epic と重複: ${e.epicId}（${e.title}）` }
    }
  }
  return { duplicate: false }
}

function previewEligibility(rec: Pick<RecommendedEpic, 'doneCriteria' | 'decisionPolicy' | 'priority' | 'riskFlags'>) {
  return evaluateFactoryEligibility(
    {
      goal: 'x',
      doneCriteria: rec.doneCriteria,
      decisionPolicy: rec.decisionPolicy,
      priority: rec.priority,
      riskFlags: rec.riskFlags,
      factoryEligible: true,
      status: 'active',
    },
    { pendingApprovalCount: 0 },
  )
}

/**
 * 抽出。Vault(収益化候補) / 既存Epic(doneCriteria未達・放置) / ExecutionRun(失敗) を見て
 * おすすめ Epic 候補を生成する。重複生成は dedupeKey で防止。自動承認は一切しない（status=suggested）。
 */
export async function generateRecommendations(): Promise<{ added: number; total: number; skipped: number }> {
  const list = await readJson<RecommendedEpic[]>(FILE, [])
  const existingKeys = new Set(list.map((r) => dedupeKey(r.kind, r.sourceRef)))
  const ts = now()
  let added = 0
  let skipped = 0

  const pushRec = async (rec: Omit<RecommendedEpic, 'createdAt' | 'updatedAt' | 'history' | 'duplicate' | 'factoryEligiblePreview'>) => {
    const key = dedupeKey(rec.kind, rec.sourceRef)
    if (existingKeys.has(key)) {
      skipped++
      return
    }
    const duplicate =
      rec.kind === 'new_epic' ? await checkDuplicateBySlug(rec.targetApp ?? slugify(rec.title)) : { duplicate: false }
    const full: RecommendedEpic = {
      ...rec,
      duplicate,
      factoryEligiblePreview: previewEligibility(rec),
      history: [{ at: ts, action: 'suggested', detail: `抽出元: ${rec.sourceKind}` }],
      createdAt: ts,
      updatedAt: ts,
    }
    list.push(full)
    existingKeys.add(key)
    added++
  }

  // --- Source A: 収益化候補（未Epic化）→ 新規Epic候補（収益化インパクト最優先） ---
  const candidates = await getCandidates()
  for (const c of candidates) {
    if (['EpicCreated', 'Building', 'Released', 'Rejected'].includes(c.status)) continue
    const slug = c.targetApp || slugify(c.name)
    const mvp = (c.mvp ?? []).filter((m) => m && m.trim())
    const doneCriteria = [
      ...mvp.map((m) => `${m} がローカルで動作し永続化される`),
      'build / typecheck / lint のいずれかが実行され結果が記録される',
      'オフラインでMVP主要機能が動作することを確認した記録がある',
    ]
    await pushRec({
      id: `rec-${slug || 'cand'}-${Date.now().toString(36).slice(-4)}-${added}`,
      status: 'suggested',
      kind: 'new_epic',
      title: `${c.name} の MVP を作る（local-first / API不要）`,
      reason: `収益化候補(score ${c.score}, ${c.category})。${c.whyNow?.summary ?? c.notes ?? ''}`.trim(),
      monetizationImpact: impactFromRevenue(c.expectedRevenue, c.score),
      targetApp: slug,
      relatedVault: c.links?.vault ? [c.links.vault] : undefined,
      relatedRunIds: c.links?.runId ? [c.links.runId] : undefined,
      priority: 'P1',
      doneCriteria,
      // MVP Epic は AI工場の自走範囲（ローカル実装・検証のみ）→ autonomous / riskFlags:[]。
      decisionPolicy: 'autonomous',
      riskFlags: [],
      preferredExecutor: 'claude',
      fallbackExecutor: 'codex',
      sourceKind: 'monetization_candidate',
      sourceRef: c.id,
      notes: 'AI工場の作業範囲（MVP設計/実装/ローカル保存/JSON/UI/build・lint・typecheck/公開前チェックリスト・ストア文言下書き・スクショ/アイコン/ASO案）まで。公開・課金・申請は含めない（下の公開/課金候補を参照）。',
    })

    // 公開申請・ストア公開は AI工場がやってはいけない範囲 → 別候補(manual / external_publish)に分離。
    await pushRec({
      id: `rec-${slug || 'cand'}-publish-${Date.now().toString(36).slice(-4)}-${added}`,
      status: 'suggested',
      kind: 'new_epic',
      title: `${c.name} を Google Play / App Store に公開申請する（ユーザー作業）`,
      reason: `公開・審査申請はユーザー作業。Apple Developer / Google Play Console 登録・審査申請・ストア公開を行う。AI工場は公開前チェックリスト/ストア文言下書き/スクショ・アイコン案まで。`,
      monetizationImpact: impactFromRevenue(c.expectedRevenue, c.score),
      targetApp: `${slug}-publish`,
      relatedVault: c.links?.vault ? [c.links.vault] : undefined,
      priority: 'P2',
      doneCriteria: ['ストア掲載情報（文言/スクショ/アイコン）を確定する', 'ストアに公開申請し審査を通過する'],
      decisionPolicy: 'manual',
      riskFlags: ['external_publish'],
      sourceKind: 'publish_task',
      sourceRef: `${c.id}:publish`,
      notes: 'external_publish のため Factory 自動実行対象外（manual / ユーザー作業）。',
    })

    // 課金設定・サブスク実装は AI工場がやってはいけない範囲 → 別候補(approval_required / billing)に分離。
    if (c.monetization?.subscription || c.monetization?.ads) {
      await pushRec({
        id: `rec-${slug || 'cand'}-billing-${Date.now().toString(36).slice(-4)}-${added}`,
        status: 'suggested',
        kind: 'new_epic',
        title: `${c.name} の課金/サブスク・AdMob本番設定（ユーザー作業）`,
        reason: `課金設定・AdMob本番・支払い情報入力はユーザー作業。AI工場は収益化導線のUIプレースホルダ設計まで。`,
        monetizationImpact: impactFromRevenue(c.expectedRevenue, c.score),
        targetApp: `${slug}-billing`,
        priority: 'P2',
        doneCriteria: ['課金/サブスク商品とAdMobを本番設定し、支払い情報を登録する'],
        decisionPolicy: 'approval_required',
        riskFlags: ['billing'],
        sourceKind: 'billing_task',
        sourceRef: `${c.id}:billing`,
        notes: 'billing のため Factory 自動実行対象外（approval_required / ユーザー作業）。',
      })
    }
  }

  // --- Source B: 既存Epic（active かつ未完）→ 既存EpicへのNext Action候補（新規Epicにしない） ---
  const epics = await getEpics()
  for (const e of epics) {
    if (e.status !== 'active') continue
    if (typeof e.progress === 'number' && e.progress >= 100) continue
    const remaining = (e.remainingWork ?? []).filter((w) => w && w.trim())
    await pushRec({
      id: `rec-next-${slugify(e.epicId).slice(0, 12)}-${Date.now().toString(36).slice(-4)}-${added}`,
      status: 'suggested',
      kind: 'existing_epic_next_action',
      title: `（既存Epicの継続）${e.title} の未完了分を進める`,
      reason: `進行中Epic（progress ${e.progress ?? '?'}）。新規Epicにせず既存EpicのNext Actionとして扱う。`,
      monetizationImpact: 'medium',
      relatedEpicId: e.epicId,
      priority: (e.priority as RecommendedEpic['priority']) ?? 'P1',
      doneCriteria:
        remaining.length > 0 ? remaining : e.doneCriteria && e.doneCriteria.length > 0 ? e.doneCriteria : [e.nextAction || '未完了分を進める'],
      decisionPolicy: e.decisionPolicy === 'autonomous' ? 'autonomous' : 'approval_required',
      riskFlags: (e.riskFlags as EpicRiskFlag[]) ?? [],
      preferredExecutor: e.preferredExecutor,
      fallbackExecutor: e.fallbackExecutor,
      sourceKind: 'active_epic_pending',
      sourceRef: e.epicId,
      notes: '承認すると新規Epicを作らず、この既存Epicの remainingWork に追記する。',
    })
  }

  // --- Source C: Factory失敗ログ（runStatus=failed）→ 既存EpicへのNext Action候補 ---
  const runs = await readExecutionRuns()
  const recentFailed = runs
    .filter((r) => r.runStatus === 'failed' && r.epicId)
    .slice(-10)
  const seenEpic = new Set<string>()
  for (const r of recentFailed) {
    const eid = r.epicId as string
    if (seenEpic.has(eid)) continue
    seenEpic.add(eid)
    await pushRec({
      id: `rec-fix-${slugify(eid).slice(0, 12)}-${Date.now().toString(36).slice(-4)}-${added}`,
      status: 'suggested',
      kind: 'existing_epic_next_action',
      title: `（Factory失敗の解消）${eid} の失敗 Run を調査・修正する`,
      reason: `直近の Factory Run が failed（runId ${r.runId}）。既存Epicの継続として失敗原因の解消を行う。`,
      monetizationImpact: 'low',
      relatedEpicId: eid,
      relatedRunIds: [r.runId],
      priority: 'P1',
      doneCriteria: ['失敗していた Run の原因を特定し、build/typecheck/lint が成功する状態にする'],
      decisionPolicy: 'approval_required',
      riskFlags: [],
      sourceKind: 'factory_failure',
      sourceRef: `fail:${eid}`,
    })
  }

  await writeJson(FILE, list)
  return { added, total: list.length, skipped }
}

/** Epic Contract（新規Epic用）を生成する。 */
function buildContract(rec: RecommendedEpic) {
  return {
    title: rec.title,
    goal: rec.reason || `${rec.title} を達成する`,
    doneCriteria: rec.doneCriteria.length > 0 ? rec.doneCriteria : ['build / typecheck / lint のいずれかが実行され結果が記録される'],
    decisionPolicy: rec.decisionPolicy,
    priority: rec.priority,
    riskFlags: rec.riskFlags,
    notes: `おすすめ追加Epic ${rec.id}（抽出元: ${rec.sourceKind} / ${rec.sourceRef ?? ''}）を人間承認で Epic化。${rec.notes ?? ''}`,
    targetApp: rec.targetApp,
    preferredExecutor: rec.preferredExecutor ?? 'claude',
    fallbackExecutor: rec.fallbackExecutor ?? 'codex',
    factoryEligible: true,
  }
}

/**
 * 承認して Epic 追加（人間が押した時のみ）。二重登録防止・重複チェック・ExecutionRun記録。
 * - new_epic: epics.json に新規Epicを追記。
 * - existing_epic_next_action: 既存Epicの remainingWork に追記（新規Epicは作らない）。
 */
export async function approveRecommendation(id: string): Promise<ApproveRecommendationResult> {
  const rec = await getRecommendation(id)
  if (!rec) return { ok: false, reason: 'おすすめが見つかりません' }
  if (rec.status === 'epic_created') return { ok: false, reason: '既に Epic化済みです（二重登録防止）' }
  if (rec.status === 'rejected') return { ok: false, reason: '却下済みです' }

  const ts = now()
  const runId = genRunId()

  // 既存Epicへの Next Action 追記
  if (rec.kind === 'existing_epic_next_action') {
    if (!rec.relatedEpicId) return { ok: false, reason: '追記先 Epic が不明です' }
    const epics = await getEpics()
    const target = epics.find((e) => e.epicId === rec.relatedEpicId)
    if (!target) return { ok: false, reason: `追記先 Epic が存在しません: ${rec.relatedEpicId}` }
    const add = rec.doneCriteria.filter((d) => !(target.remainingWork ?? []).includes(d))
    await updateEpic(rec.relatedEpicId, { remainingWork: [...(target.remainingWork ?? []), ...add] })
    const run: ExecutionRun = {
      runId, startedAt: ts, finishedAt: ts, targetApp: 'progress', epicId: rec.relatedEpicId,
      targetTodoTitle: `おすすめ承認: ${rec.title}（既存Epicへ Next Action 追記）`,
      runStatus: 'completed', reviewStatus: 'not_reviewed', source: 'recommended_epics',
      summary: `おすすめ ${rec.id} を承認し既存Epic ${rec.relatedEpicId} の remainingWork に ${add.length} 件追記`,
      changedFiles: [{ file: 'data/real/epics.json', change: `${rec.relatedEpicId} remainingWork 追記` }],
      checks: {}, errors: [], warnings: [], progressUpdated: false, nextActions: add, rawReport: `おすすめ追加Epic（既存Epic継続）を人間承認。${rec.reason}`,
    }
    await addExecutionRun(run)
    await updateRecommendation(id, {
      status: 'epic_created',
      createdEpicId: rec.relatedEpicId,
      history: [...(rec.history ?? []), { at: ts, action: 'status:epic_created', detail: `既存Epic ${rec.relatedEpicId} へ追記 / runId ${runId}` }],
    })
    return { ok: true, updatedEpicId: rec.relatedEpicId, runId }
  }

  // 新規Epic作成
  const dup = await checkDuplicateBySlug(rec.targetApp ?? slugify(rec.title))
  if (dup.duplicate) return { ok: false, reason: dup.reason }

  const contract = buildContract(rec)
  const result = validateEpicContract(contract)
  if (!result.ok || !result.normalized) {
    return { ok: false, reason: `Epic Contract 検証に失敗: ${result.errors.join(' / ')}` }
  }
  const epic = await createEpic(result.normalized)
  const eligibility = evaluateFactoryEligibility(
    { goal: epic.goal, doneCriteria: epic.doneCriteria, decisionPolicy: epic.decisionPolicy, priority: epic.priority, riskFlags: epic.riskFlags, factoryEligible: epic.factoryEligible, status: 'active' },
    { pendingApprovalCount: 0 },
  )
  const run: ExecutionRun = {
    runId, startedAt: ts, finishedAt: ts, targetApp: 'progress', epicId: epic.epicId,
    targetTodoTitle: `おすすめ承認: ${rec.title} を Epic化`,
    runStatus: 'completed', reviewStatus: 'not_reviewed', source: 'recommended_epics',
    summary: `おすすめ ${rec.id} を承認し Epic ${epic.epicId} を作成（factoryEligible=${eligibility.eligible}）`,
    changedFiles: [
      { file: 'data/real/epics.json', change: `Epic ${epic.epicId} 追記` },
      { file: 'data/real/recommended-epics.json', change: `${rec.id} → epic_created` },
    ],
    checks: {}, errors: [],
    warnings: eligibility.eligible ? [] : [`Factory自動対象外: ${eligibility.reasons.join(' / ')}`],
    progressUpdated: false, nextActions: [],
    rawReport: `おすすめ追加Epicを人間承認で Epic化。抽出元 ${rec.sourceKind}/${rec.sourceRef}。decisionPolicy=${epic.decisionPolicy} riskFlags=${(epic.riskFlags ?? []).join(',')} factoryEligible=${eligibility.eligible}（${eligibility.reasons.join(' / ') || '自動実行可'}）。`,
  }
  await addExecutionRun(run)
  await updateRecommendation(id, {
    status: 'epic_created',
    createdEpicId: epic.epicId,
    factoryEligiblePreview: {
      eligible: eligibility.eligible,
      reasons: eligibility.reasons,
      classification: eligibility.classification,
      factoryManaged: eligibility.factoryManaged,
    },
    history: [...(rec.history ?? []), { at: ts, action: 'status:epic_created', detail: `Epic ${epic.epicId} 作成 / runId ${runId}` }],
  })
  return { ok: true, epicId: epic.epicId, runId }
}
