import type {
  Epic,
  EpicContractInput,
  EpicValidationResult,
  EpicPriority,
  EpicRiskFlag,
  DecisionPolicy,
  FactoryEligibility,
  FactoryClassification,
  RiskLevel,
  ExecutorType,
} from './types/operations'

// Epic Contract: 自動化テスト前にユーザーが明示する契約。
// Factory / Auto Resume が曖昧な Epic を勝手に解釈しないよう、作成/インポート時に必須項目を検証する。
// 新しい正本は作らない（Epic は epics.json が唯一の正本）。executor 非依存。

export const DECISION_POLICIES: DecisionPolicy[] = ['autonomous', 'approval_required', 'manual']
export const EPIC_PRIORITIES: EpicPriority[] = ['P0', 'P1', 'P2']
export const RISK_FLAGS: EpicRiskFlag[] = [
  'billing',
  'production_db',
  'auth_secret',
  'deploy',
  'migration',
  'destructive',
  'external_publish',
]
export const EXECUTORS: ExecutorType[] = ['claude', 'codex', 'manual', 'other']

// 人間承認が必要な危険フラグ。これらがあると自律自動実行はせず「要承認」にする。
// 破壊的・課金・本番DB・認証秘密情報・マイグレーション・外部公開のみ。deploy は含めない。
export const APPROVAL_RISK_FLAGS: EpicRiskFlag[] = [
  'billing',
  'production_db',
  'auth_secret',
  'migration',
  'destructive',
  'external_publish',
]

// 承認は不要だが注意表示する「注意フラグ」。deploy は自動実行対象のまま・注意のみ。
export const CAUTION_RISK_FLAGS: EpicRiskFlag[] = ['deploy']

// 後方互換: 旧名。承認必須フラグ（= APPROVAL_RISK_FLAGS）を指す。deploy はもう含まない。
export const FACTORY_BLOCKING_RISK_FLAGS: EpicRiskFlag[] = APPROVAL_RISK_FLAGS

/** riskFlag を承認必須として扱うか（未知フラグは安全側に倒して承認必須とみなす）。 */
function isApprovalFlag(f: EpicRiskFlag): boolean {
  return !CAUTION_RISK_FLAGS.includes(f)
}

const POLICY_LABEL: Record<string, string> = {
  autonomous: 'autonomous（AIが自律判断して進めてよい）',
  approval_required: 'approval_required（重要判断はApproval Queueへ）',
  manual: 'manual（自動実行対象にしない）',
  budget_sensitive: 'budget_sensitive（旧・予算センシティブ）',
  destructive_sensitive: 'destructive_sensitive（旧・破壊センシティブ）',
}

export function decisionPolicyLabel(p?: string): string {
  return p ? (POLICY_LABEL[p] ?? p) : '未設定'
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Epic 契約のバリデーション。
 * 必須: goalId / title / goal / doneCriteria(1件以上) / decisionPolicy / priority / riskFlags(配列・未知値はエラー)。
 * 任意: notes / targetApp / relatedRepo / preferredExecutor / fallbackExecutor / factoryEligible。
 */
export function validateEpicContract(raw: unknown): EpicValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, errors: ['JSON オブジェクトではありません'], warnings: [] }
  }
  const o = raw as Record<string, unknown>

  // title
  if (!isNonEmptyString(o.title)) errors.push('title が空です')

  // goalId
  if (!isNonEmptyString(o.goalId)) errors.push('goalId が空です（Epic は必ず Goal に紐付けてください）')

  // goal
  if (!isNonEmptyString(o.goal)) errors.push('goal が空です')

  // doneCriteria
  let doneCriteria: string[] = []
  if (!Array.isArray(o.doneCriteria)) {
    errors.push('doneCriteria が配列ではありません')
  } else {
    doneCriteria = o.doneCriteria.filter(isNonEmptyString).map((s) => s.trim())
    if (doneCriteria.length === 0) errors.push('doneCriteria が空です（1 件以上必要）')
  }

  // decisionPolicy
  const dp = o.decisionPolicy
  if (!isNonEmptyString(dp) || !DECISION_POLICIES.includes(dp as DecisionPolicy)) {
    errors.push(`decisionPolicy が不正です（${DECISION_POLICIES.join(' / ')} のいずれか）`)
  }

  // priority
  const pr = o.priority
  if (!isNonEmptyString(pr) || !EPIC_PRIORITIES.includes(pr as EpicPriority)) {
    errors.push(`priority が不正です（${EPIC_PRIORITIES.join(' / ')} のいずれか）`)
  }

  // riskFlags
  let riskFlags: EpicRiskFlag[] = []
  if (o.riskFlags === undefined) {
    warnings.push('riskFlags 未指定のため [] として扱います')
  } else if (!Array.isArray(o.riskFlags)) {
    errors.push('riskFlags が配列ではありません')
  } else {
    const unknown = o.riskFlags.filter((f) => !RISK_FLAGS.includes(f as EpicRiskFlag))
    if (unknown.length > 0) {
      errors.push(`riskFlags に未知の値: ${unknown.join(', ')}（許可値: ${RISK_FLAGS.join(' / ')}）`)
    }
    riskFlags = o.riskFlags.filter((f): f is EpicRiskFlag => RISK_FLAGS.includes(f as EpicRiskFlag))
  }

  // 任意 executor
  const preferredExecutor = normalizeExecutor(o.preferredExecutor, warnings, 'preferredExecutor')
  const fallbackExecutor = normalizeExecutor(o.fallbackExecutor, warnings, 'fallbackExecutor')

  if (errors.length > 0) {
    return { ok: false, errors, warnings }
  }

  const normalized: EpicContractInput = {
    goalId: (o.goalId as string).trim(),
    title: (o.title as string).trim(),
    goal: (o.goal as string).trim(),
    doneCriteria,
    decisionPolicy: dp as DecisionPolicy,
    priority: pr as EpicPriority,
    riskFlags,
    notes: isNonEmptyString(o.notes) ? (o.notes as string).trim() : undefined,
    targetApp: isNonEmptyString(o.targetApp) ? (o.targetApp as string).trim() : undefined,
    relatedRepo: isNonEmptyString(o.relatedRepo) ? (o.relatedRepo as string).trim() : undefined,
    preferredExecutor,
    fallbackExecutor,
    factoryEligible: typeof o.factoryEligible === 'boolean' ? o.factoryEligible : undefined,
  }

  return { ok: true, errors: [], warnings, normalized }
}

function normalizeExecutor(v: unknown, warnings: string[], field: string): ExecutorType | undefined {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'string' && EXECUTORS.includes(v as ExecutorType)) return v as ExecutorType
  warnings.push(`${field} が不正な値のため無視します`)
  return undefined
}

/**
 * Factory / Auto Resume の自動実行対象判定（純粋関数）。判定を 4 概念に分離する。
 *
 * 区分（classification）は 3 つ:
 *  - excluded（Factory対象外）: factoryEligible=false / decisionPolicy=manual / 契約の構造不備
 *  - approval（要承認）       : 承認必須 riskFlags / approval_required / Approval待ち / blocked
 *  - auto（自律実行可）        : 上記いずれにも該当しない（deploy 等の注意フラグは付いてよい）
 *
 * 重要:
 *  - deploy だけの riskFlags は「要承認」にせず auto のまま。riskLevel='caution' で注意表示する。
 *  - 承認必須フラグ（billing / production_db / auth_secret / migration / destructive / external_publish）だけが要承認。
 *  - autonomous + factoryEligible:true + 承認必須フラグなし → auto（自動実行対象）。
 * eligible（厳格ゲート）は classification==='auto' のときだけ true。実行側はこれを見る。
 * pendingApprovalCount は呼び出し側が渡す。
 */
export function evaluateFactoryEligibility(
  epic: Pick<
    Epic,
    'goal' | 'doneCriteria' | 'decisionPolicy' | 'priority' | 'riskFlags' | 'factoryEligible' | 'status'
  >,
  ctx: { pendingApprovalCount: number },
): FactoryEligibility {
  const excludedReasons: string[] = []
  const approvalReasons: string[] = []

  // 構造的完全性（不備は契約として成立しないので対象外）
  if (!epic.goal || !epic.goal.trim()) excludedReasons.push('goal が空')
  if (!epic.doneCriteria || epic.doneCriteria.length === 0) excludedReasons.push('doneCriteria が無い')
  if (!epic.decisionPolicy) excludedReasons.push('decisionPolicy 未設定')
  if (!epic.priority) excludedReasons.push('priority 未設定')

  // 明示除外
  if (epic.factoryEligible === false) excludedReasons.push('factoryEligible=false（明示除外）')
  if (epic.decisionPolicy === 'manual') excludedReasons.push('decisionPolicy=manual（手動のみ・自動実行不可）')

  // riskFlags を「承認必須」と「注意のみ」に分ける
  const flags = epic.riskFlags ?? []
  const approvalFlags = flags.filter(isApprovalFlag)
  const cautionFlags = flags.filter((f) => CAUTION_RISK_FLAGS.includes(f))

  // 要承認（Factory 管理対象だが自律自動実行はしない）
  if (epic.decisionPolicy === 'approval_required')
    approvalReasons.push('decisionPolicy=approval_required（承認待ち）')
  if (approvalFlags.length > 0) approvalReasons.push(`riskFlags: ${approvalFlags.join(', ')}（要承認）`)
  if (ctx.pendingApprovalCount > 0) approvalReasons.push('Approval 待ちあり')
  if (epic.status === 'blocked') approvalReasons.push('Epic が blocked（Decision/対応待ち）')

  const classification: FactoryClassification =
    excludedReasons.length > 0 ? 'excluded' : approvalReasons.length > 0 ? 'approval' : 'auto'

  // 注意度: 承認必須フラグ → approval / 注意フラグのみ → caution / なし → none
  const riskLevel: RiskLevel =
    approvalFlags.length > 0 ? 'approval' : cautionFlags.length > 0 ? 'caution' : 'none'

  return {
    eligible: classification === 'auto',
    reasons: [...excludedReasons, ...approvalReasons],
    classification,
    factoryManaged: classification !== 'excluded',
    approvalRequired: classification === 'approval',
    riskLevel,
    approvalReasons,
    excludedReasons,
    cautionFlags,
  }
}

/** 表示用ラベル情報。主バッジ（Factory対象/対象外）・副バッジ（要承認/自律可）・注意チップ（デプロイ注意）を分けて出す。 */
export interface FactoryDisplay {
  /** true→「⚙ Factory対象」/ false→「🚫 Factory対象外」 */
  managed: boolean
  primaryLabel: string
  /** managed のときのみ。承認が必要なら true。 */
  needsApproval: boolean
  /** managed のときの副バッジ文言。対象外のときは null。 */
  secondaryLabel: string | null
  /** 注意チップ文言（deploy 等の注意フラグがあるとき）。なければ null。 */
  cautionLabel: string | null
  /** 補足（要承認理由 / 対象外理由 / 注意フラグ）。 */
  detail: string
}

/** FactoryEligibility を画面表示用ラベルに変換する（全カードで文言を統一するための単一ソース）。 */
export function describeFactory(elig: FactoryEligibility): FactoryDisplay {
  const cautionLabel =
    elig.factoryManaged && elig.cautionFlags.length > 0
      ? (elig.cautionFlags.includes('deploy') ? '⚠ デプロイ注意' : `⚠ 注意: ${elig.cautionFlags.join(', ')}`)
      : null

  if (!elig.factoryManaged) {
    return {
      managed: false,
      primaryLabel: '🚫 Factory対象外',
      needsApproval: false,
      secondaryLabel: null,
      cautionLabel: null,
      detail: elig.excludedReasons.join(' / '),
    }
  }
  const needsApproval = elig.approvalRequired
  const detailParts: string[] = []
  if (needsApproval) detailParts.push(elig.approvalReasons.join(' / '))
  else detailParts.push('契約OK・自律自動実行可')
  if (elig.cautionFlags.length > 0) detailParts.push(`注意フラグ: ${elig.cautionFlags.join(', ')}（自動実行はするが要確認）`)

  return {
    managed: true,
    primaryLabel: '⚙ Factory対象',
    needsApproval,
    secondaryLabel: needsApproval ? '🛡 要承認' : '✅ 自律実行可',
    cautionLabel,
    detail: detailParts.join(' / '),
  }
}

/**
 * 実行プロンプト（Claude / Codex）に入れる安全ガードを riskFlags に応じて生成する単一ソース。
 *
 * 方針:
 *  - deploy は「禁止」にしない。実装・build・lint・typecheck・必要な commit/push までは進めてよい。
 *    本番反映・外部公開は「事後報告 / 確認事項」として残す扱い（caution）。
 *  - 課金 / 本番DB / 認証情報・secret・token・.env / migration / destructive / 外部公開 は常に禁止のまま。
 *    （これらは APPROVAL_RISK_FLAGS 相当で、そもそも要承認だが、実行プロンプト側でも多層防御として禁止を明示する）
 */
export function buildExecutionGuard(riskFlags?: EpicRiskFlag[]): { forbidden: string[]; cautions: string[] } {
  const flags = riskFlags ?? []
  const forbidden: string[] = [
    '課金(billing)を発生させない',
    '本番DB(production_db)変更・migration・destructive操作（削除 / drop / truncate）をしない',
    '認証情報・secret・token・.env の閲覧・変更をしない',
    '外部公開(external_publish)を勝手にしない',
    'doneCriteria 以外の余計な変更をしない',
    'Approval / Decision 待ちの作業を勝手に進めない',
    '完全自動ループ・CLI 直叩き・cron / pm2 / systemd 変更をしない',
  ]
  const cautions: string[] = []
  if (flags.includes('deploy')) {
    cautions.push(
      'デプロイ注意: 実装・build・lint・typecheck・必要な commit/push までは進めてよい。' +
        '本番反映（Vercel / Supabase 等）や外部公開を行った場合は事後報告し、未実行なら確認事項として残すこと。' +
        '本番破壊・環境変数(.env)変更はしない。',
    )
  }
  return { forbidden, cautions }
}

// ---- JSON テンプレ（ChatGPT / Claude / Codex に渡して埋めてもらう用） ----

export const EPIC_TEMPLATE: EpicContractInput & { targetApp: string } = {
  goalId: '',
  title: '',
  goal: '',
  doneCriteria: [''],
  decisionPolicy: 'autonomous',
  priority: 'P1',
  riskFlags: [],
  notes: '',
  targetApp: '',
  relatedRepo: '',
  preferredExecutor: 'claude',
  fallbackExecutor: 'codex',
  factoryEligible: true,
}

/**
 * テンプレのコピー用テキスト。入れ子コードブロック（```）は使わない（モバイル/プロンプト貼り付け対応）。
 * 先頭に短い説明を付け、その下に JSON 本体を素のテキストで置く。
 */
export function epicTemplateText(): string {
  return [
    '次の Epic 契約 JSON の空欄を埋めてください。goalId は既存GoalのIDを必ず入れてください。decisionPolicy は autonomous / approval_required / manual のいずれか、priority は P0 / P1 / P2、riskFlags は billing / production_db / auth_secret / deploy / migration / destructive / external_publish から該当するものだけ。doneCriteria は検証可能な完了条件を 1 件以上。',
    '',
    JSON.stringify(EPIC_TEMPLATE, null, 2),
  ].join('\n')
}
