import { readJson, writeJson } from '@/lib/store'
import { getEpics, createEpic } from '@/lib/operations-store'
import { validateEpicContract, evaluateFactoryEligibility } from '@/lib/epic-contract'
import { addExecutionRun } from '@/lib/execution-run-writer'
import type { ExecutionRun } from '@/types/execution-run'
import type {
  MonetizationCandidate,
  CandidateStatus,
  ResearchLog,
  HistoryEntry,
  PromoteResult,
} from '@/types/monetization'

// Monetization Hub のデータアクセス層。
// data/real/monetization-candidates.json を正本とし、CRUD・状態遷移・調査履歴・Epic化を担う。
// 既存の epics.json は createEpic（追記のみ）で触る。新しい正本は作らない。Epic化は人間操作のみ。

const FILE = 'monetization-candidates.json'

/** 重複チェック対象の既存アプリ（slug 化済み）。実装済み/進行中アプリ。 */
const EXISTING_APP_SLUGS = [
  'progress',
  'goalplanner',
  'goal-planner',
  'netscope',
  'mahjong',
  'nanikiru',
  'nanikirushorts',
  'shogi',
  'shogitrainer',
  'news',
  'newsapp',
  'scrapelab',
  'scrape-lab',
]

function now(): string {
  return new Date().toISOString()
}

/** 文字列から英数スラッグを作る（"野鳥観察ノート BirdLog" -> "birdlog"）。 */
export function slugify(input: string): string {
  const ascii = (input.match(/[A-Za-z0-9]+/g) ?? []).join('').toLowerCase()
  return ascii
}

function genRunId(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

function genId(name: string): string {
  const base = slugify(name) || 'cand'
  return `mc-${base.slice(0, 16)}-${Date.now().toString(36).slice(-4)}`
}

export async function getCandidates(): Promise<MonetizationCandidate[]> {
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  // 総合スコア降順（同点は更新日時降順）。
  return [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
}

export async function getCandidate(id: string): Promise<MonetizationCandidate | null> {
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  return list.find((c) => c.id === id) ?? null
}

export async function createCandidate(
  input: Partial<MonetizationCandidate> & { name: string },
): Promise<MonetizationCandidate> {
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  const ts = now()
  const candidate: MonetizationCandidate = {
    ...input,
    id: input.id?.trim() || genId(input.name),
    name: input.name.trim(),
    category: input.category ?? '未分類',
    status: input.status ?? 'Draft',
    score: typeof input.score === 'number' ? input.score : 0,
    targetApp: input.targetApp || slugify(input.name),
    discoveredAt: input.discoveredAt ?? ts,
    updatedAt: ts,
    history: [{ at: ts, action: 'created', detail: '候補を登録' }, ...(input.history ?? [])],
  }
  list.push(candidate)
  await writeJson(FILE, list)
  return candidate
}

export async function updateCandidate(
  id: string,
  patch: Partial<MonetizationCandidate>,
): Promise<MonetizationCandidate | null> {
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  const idx = list.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const updated: MonetizationCandidate = {
    ...list[idx],
    ...patch,
    id: list[idx].id,
    discoveredAt: list[idx].discoveredAt,
    updatedAt: now(),
  }
  list[idx] = updated
  await writeJson(FILE, list)
  return updated
}

/** 状態遷移（操作履歴を残す）。 */
export async function changeStatus(
  id: string,
  status: CandidateStatus,
  detail?: string,
): Promise<MonetizationCandidate | null> {
  const c = await getCandidate(id)
  if (!c) return null
  const history: HistoryEntry[] = [
    ...(c.history ?? []),
    { at: now(), action: `status:${status}`, detail },
  ]
  return updateCandidate(id, { status, history })
}

/** 調査履歴を1件追加し、最終調査日を更新する。 */
export async function addResearchLog(id: string, log: ResearchLog): Promise<MonetizationCandidate | null> {
  const c = await getCandidate(id)
  if (!c) return null
  const researchLogs: ResearchLog[] = [...(c.researchLogs ?? []), log]
  const history: HistoryEntry[] = [
    ...(c.history ?? []),
    { at: now(), action: 'research', detail: `${log.type}: ${log.note}`.slice(0, 120) },
  ]
  return updateCandidate(id, { researchLogs, lastResearchedAt: log.date || now(), history })
}

/**
 * 重複チェック。既存 Epic / 実装済みアプリ / 進行中アプリ（EpicCreated 済み候補）と衝突したら理由を返す。
 */
export async function checkDuplicate(
  candidate: MonetizationCandidate,
): Promise<{ duplicate: boolean; reason?: string }> {
  const slug = candidate.targetApp || slugify(candidate.name)
  if (!slug) return { duplicate: false }

  // 1) 実装済み/進行中アプリ
  if (EXISTING_APP_SLUGS.includes(slug)) {
    return { duplicate: true, reason: `実装済み/進行中アプリと重複: ${slug}` }
  }

  // 2) 既存 Epic（title / targetApps / epicId にスラッグが含まれる）
  const epics = await getEpics()
  for (const e of epics) {
    const haystack = [e.title ?? '', e.epicId ?? '', ...(e.targetApps ?? [])].map((s) => slugify(s)).join(' ')
    if (haystack.includes(slug)) {
      return { duplicate: true, reason: `既存 Epic と重複: ${e.epicId}（${e.title}）` }
    }
  }

  // 3) すでに Epic化済みの別候補
  const list = await readJson<MonetizationCandidate[]>(FILE, [])
  const dupCand = list.find(
    (c) => c.id !== candidate.id && c.status === 'EpicCreated' && (c.targetApp || slugify(c.name)) === slug,
  )
  if (dupCand) {
    return { duplicate: true, reason: `Epic化済みの候補と重複: ${dupCand.id}（${dupCand.name}）` }
  }

  return { duplicate: false }
}

/** 候補から Epic Contract 入力を生成する。 */
function buildEpicContract(candidate: MonetizationCandidate) {
  const slug = candidate.targetApp || slugify(candidate.name)
  const mvp = (candidate.mvp ?? []).filter((s) => s && s.trim().length > 0)
  const doneCriteria: string[] = [
    ...mvp.map((m) => `${m} がローカルで動作し永続化される`),
    'build / typecheck / lint のいずれかが実行され結果が記録される',
    'オフライン（ネットワーク遮断）でMVP主要機能が動作することを確認した記録がある',
  ]
  // 最低1件は保証（mvp が空でも build 判定が残る）
  const goalParts = [
    candidate.whyNow?.summary || candidate.problem || `${candidate.name} の価値を検証する`,
    'local-first（外部API・サーバDB・課金実装・公開作業なし）で MVP を実装し、ローカル検証（build/lint/typecheck・オフライン動作）まで完了する。公開・課金・申請は別Epic（ユーザー作業）として分離する。',
  ]
  const moneyLine = candidate.monetization
    ? `収益化導線: ${[
        candidate.monetization.ads && '広告',
        candidate.monetization.subscription && 'サブスク',
        candidate.monetization.oneTime && '買い切り',
        candidate.monetization.affiliate && 'アフィリエイト',
      ]
        .filter(Boolean)
        .join(' / ')} をUIプレースホルダとして設計に含める。`
    : ''
  return {
    title: `${candidate.name} の MVP を作る（local-first / API不要）`,
    goal: `${goalParts.join(' ')} ${moneyLine}`.trim(),
    doneCriteria,
    // MVP Epic は AI工場が安全に自走できる範囲（ローカル実装・検証のみ）。
    // 公開/課金/申請は本Epicに含めない → autonomous / riskFlags:[] / factoryEligible:true。
    decisionPolicy: 'autonomous' as const,
    priority: 'P1' as const,
    riskFlags: [] as const,
    notes: `Monetization Hub の候補 ${candidate.id}（総合スコア ${candidate.score}）から Epic化した MVP Epic。AI工場の作業範囲＝MVP設計/画面実装/ローカル保存/JSON/UI/build・lint・typecheck/公開前チェックリスト・ストア文言下書き・スクショ/アイコン/ASO案まで。Google Play/App Store 公開・課金実装・AdMob本番・支払い情報・審査申請はユーザー作業のため本Epicに含めず、別の manual/approval_required Epic（external_publish / billing）として分離する。カテゴリ: ${candidate.category}。`,
    targetApp: slug,
    preferredExecutor: 'claude' as const,
    fallbackExecutor: 'codex' as const,
    factoryEligible: true,
  }
}

/**
 * Epic化（人間がボタンを押した時のみ呼ぶ）。
 * 1) 重複チェック → 2) Epic Contract生成 → 3) epics.json追加 → 4) 状態EpicCreated → 5) 操作履歴 → 6) ExecutionRun記録。
 */
export async function promoteToEpic(id: string): Promise<PromoteResult> {
  const candidate = await getCandidate(id)
  if (!candidate) return { ok: false, reason: '候補が見つかりません' }
  if (candidate.status === 'EpicCreated' || candidate.status === 'Building' || candidate.status === 'Released') {
    return { ok: false, reason: `この候補は既に ${candidate.status} です` }
  }

  // 1) 重複チェック
  const dup = await checkDuplicate(candidate)
  if (dup.duplicate) return { ok: false, reason: dup.reason }

  // 2) Epic Contract生成 + 検証
  const contract = buildEpicContract(candidate)
  const result = validateEpicContract(contract)
  if (!result.ok || !result.normalized) {
    return { ok: false, reason: `Epic Contract 検証に失敗: ${result.errors.join(' / ')}` }
  }

  // 3) epics.json追加（追記のみ・既存破壊なし）
  const epic = await createEpic(result.normalized)
  const eligibility = evaluateFactoryEligibility(
    {
      goal: epic.goal,
      doneCriteria: epic.doneCriteria,
      decisionPolicy: epic.decisionPolicy,
      priority: epic.priority,
      riskFlags: epic.riskFlags,
      factoryEligible: epic.factoryEligible,
      status: 'active',
    },
    { pendingApprovalCount: 0 },
  )

  // 6) ExecutionRun記録
  const ts = now()
  const runId = genRunId()
  const run: ExecutionRun = {
    runId,
    startedAt: ts,
    finishedAt: ts,
    targetApp: 'progress',
    epicId: epic.epicId,
    targetTodoTitle: `Monetization Hub: ${candidate.name} を人間承認で Epic化`,
    runStatus: 'completed',
    reviewStatus: 'not_reviewed',
    source: 'monetization_hub',
    summary: `候補 ${candidate.id}（score ${candidate.score}）を承認し Epic ${epic.epicId} を作成（factoryEligible=${eligibility.eligible}）`,
    changedFiles: [
      { file: 'data/real/epics.json', change: `Epic ${epic.epicId} 追記` },
      { file: 'data/real/monetization-candidates.json', change: `${candidate.id} status→EpicCreated` },
    ],
    checks: {},
    errors: [],
    warnings: eligibility.eligible ? [] : [`Factory自動対象外: ${eligibility.reasons.join(' / ')}`],
    progressUpdated: false,
    nextActions: [],
    rawReport: `Monetization Hub からの Epic化。候補 ${candidate.id}「${candidate.name}」を人間承認で Epic ${epic.epicId} に昇格。decisionPolicy=${epic.decisionPolicy} / riskFlags=${(epic.riskFlags ?? []).join(',')} / factoryEligible=${eligibility.eligible}（${eligibility.reasons.join(' / ') || '自動実行可'}）。`,
  }
  await addExecutionRun(run)

  // 4) 状態EpicCreated + 5) 操作履歴 + リンク
  await updateCandidate(id, {
    status: 'EpicCreated',
    links: { ...(candidate.links ?? {}), epicId: epic.epicId, runId },
    history: [
      ...(candidate.history ?? []),
      { at: ts, action: 'status:EpicCreated', detail: `Epic ${epic.epicId} を作成 / runId ${runId}` },
    ],
  })

  return { ok: true, epicId: epic.epicId, runId }
}
