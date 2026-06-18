import type { QueueControl } from '@/types/auto-queue'

// Epic Contract の標準 3 値（autonomous / approval_required / manual）に加え、
// 旧データ互換のため budget_sensitive / destructive_sensitive も型として残す（読み取り時のみ）。
export type DecisionPolicy =
  | 'autonomous'
  | 'approval_required'
  | 'manual'
  | 'budget_sensitive'
  | 'destructive_sensitive'

/** Epic Contract: 自動化テスト前にユーザーが明示する優先度。 */
export type EpicPriority = 'P0' | 'P1' | 'P2'

/** Epic Contract: 危険シグナル。1 つでもあれば Factory/Auto Resume の自動実行対象から外す（Approval 必須）。 */
export type EpicRiskFlag =
  | 'billing'
  | 'production_db'
  | 'auth_secret'
  | 'deploy'
  | 'migration'
  | 'destructive'
  | 'external_publish'
export type ApprovalPriority = 'critical' | 'high' | 'normal' | 'low'
export type ApprovalCategory =
  | 'goal_change'
  | 'billing'
  | 'destructive'
  | 'production_risk'
  | 'secret'
  | 'external_publish'
  | 'monetization'
  | 'multi_option'
  | 'executor_fallback'

export type ExecutorType = 'claude' | 'codex' | 'manual' | 'other'

export interface Epic {
  epicId: string
  goalId?: string
  githubIssue?: number
  title: string
  goal: string
  progress: number
  remainingWork: string[]
  latestRunId?: string | null
  blockers?: string[]
  lastReviewSummary?: string
  nextAction: string
  decisionPolicy: DecisionPolicy
  autoApprovalRule?: string
  status: 'proposed' | 'approved' | 'active' | 'in_review' | 'done' | 'merged' | 'split' | 'dropped' | 'paused' | 'blocked'
  relatedTodoIds?: string[]
  /** 任意。この Epic に属する ExecutionRun を targetApp でフォールバック結合するためのキー群（例: ["progress","ny01/progress"]）。 */
  targetApps?: string[]
  // ---- Epic Contract（自動化テストの明示的契約。既存 Epic 互換のため全て任意） ----
  /** 完了条件。1 件以上で Factory 対象になりうる。 */
  doneCriteria?: string[]
  /** 優先度（P0/P1/P2）。 */
  priority?: EpicPriority
  /** 危険シグナル。1 つでもあれば自律自動実行は不可で「要承認」になる（ただし Factory対象外にはしない）。 */
  riskFlags?: EpicRiskFlag[]
  /** 補足メモ。 */
  notes?: string
  /** 関連リポジトリ（任意）。 */
  relatedRepo?: string
  targetApp?: string
  /** 優先実行者（executor 非依存。例: claude）。 */
  preferredExecutor?: ExecutorType
  /** フォールバック実行者（例: codex）。 */
  fallbackExecutor?: ExecutorType
  /** ユーザーの opt-in ヒント。true でも安全条件を満たさなければ自動対象にしない（安全が優先）。 */
  factoryEligible?: boolean
  /** 自動実行キュー上のユーザー手動操作。キュー自体は派生ビューであり永続化しない。 */
  queueControl?: QueueControl
  updatedAt: string
}

/** Epic 作成/インポートの入力契約（バリデーション前の生入力に近い形）。 */
export interface EpicContractInput {
  goalId?: string
  title: string
  goal: string
  doneCriteria: string[]
  decisionPolicy: DecisionPolicy
  priority: EpicPriority
  riskFlags: EpicRiskFlag[]
  notes?: string
  targetApp?: string
  relatedRepo?: string
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  factoryEligible?: boolean
}

/** Epic Contract バリデーション結果。ok=false なら errors を表示し作成しない。 */
export interface EpicValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  /** ok 時のみ。正規化済みの作成用契約。 */
  normalized?: EpicContractInput
}

/** 表示・運用区分。
 * - auto: 自律自動実行可（Factory対象・承認不要。deploy 等の注意フラグは付いてよい）
 * - approval: Factory対象だが承認が必要（危険 riskFlags / approval_required / Approval待ち / blocked）
 * - excluded: Factory対象外（factoryEligible=false / decisionPolicy=manual / 契約の構造不備）
 */
export type FactoryClassification = 'auto' | 'approval' | 'excluded'

/** 注意度。
 * - none: 危険・注意フラグなし
 * - caution: 注意フラグのみ（deploy 等）。自動実行はするが注意表示する
 * - approval: 承認が必要な危険フラグあり（billing / production_db / auth_secret / migration / destructive / external_publish）
 */
export type RiskLevel = 'none' | 'caution' | 'approval'

/** Factory/Auto Resume の自動実行対象判定（4 概念に分離）。
 * - factoryManaged: 工場で処理できるか（excluded 以外）
 * - approvalRequired: 人間承認が必要か
 * - riskLevel: 注意度（none / caution / approval）
 * - eligible: 自律自動実行が可能か（厳格ゲート＝classification==='auto'）。実行側はこれを見る。
 * deploy だけの riskFlags は承認不要＝自動実行対象のまま（riskLevel='caution'）。 */
export interface FactoryEligibility {
  /** 自律自動実行が可能か（厳格ゲート。classification==='auto' と一致）。 */
  eligible: boolean
  /** eligible=false の全理由（excludedReasons + approvalReasons）。実行側のブロック理由表示に使う。 */
  reasons: string[]
  /** 表示・運用区分。 */
  classification: FactoryClassification
  /** Factory 管理対象か（excluded 以外 true）。true→「Factory対象」表示。 */
  factoryManaged: boolean
  /** 人間承認が必要か（classification==='approval' と一致）。 */
  approvalRequired: boolean
  /** 注意度（none / caution / approval）。 */
  riskLevel: RiskLevel
  /** 承認が必要な理由（危険 riskFlags / approval_required / Approval待ち / blocked）。 */
  approvalReasons: string[]
  /** 対象外の理由（factoryEligible=false / manual / 構造不備）。 */
  excludedReasons: string[]
  /** 承認は不要だが注意が必要なフラグ（deploy 等）。 */
  cautionFlags: EpicRiskFlag[]
}

// ---- Factory Dispatch（scan/pick で選ばれた Epic を executor へ渡す準備。完全自動ループは作らない）----

/** dispatch 候補の実行者。claude / codex / manual（manual は自動対象外）。 */
export type ExecutorChoice = 'claude' | 'codex' | 'manual'
export type DispatchSafetyStatus = 'ok' | 'blocked'
export type DispatchPromptType = 'claude_factory' | 'codex_handoff' | 'none'

/**
 * Factory Dispatch Plan（生成ビュー / 新しい正本ではない）。
 * 既存正本（Epic Contract / Approval / Decision / ExecutionRun）から都度生成する。
 * 永続化はせず、結果戻し時に ExecutionRun（既存正本）へ dispatchPlanId 等を記録する。
 */
export interface FactoryDispatchPlan {
  /** 生成ビューの一意キー（dp-<epicId>-<base36ts>）。永続正本ではない。 */
  dispatchPlanId: string
  epicId: string
  epicTitle: string
  goal: string
  doneCriteria: string[]
  /** なぜこの Epic が pick されたか。 */
  selectedReason: string
  executorCandidate: ExecutorChoice
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  canRunOnCodex: boolean
  requiresClaude: boolean
  requiresApproval: boolean
  approvalStatus: 'none' | 'pending'
  decisionStatus: 'ok' | 'waiting'
  riskFlags: EpicRiskFlag[]
  nextActions: string[]
  /** この Epic に紐づく人間の修正指示（needs_followup Run の fixPrompt / 承認済み修正依頼）。dispatch プロンプトに最優先で載せる。 */
  humanFixInstructions: string[]
  promptType: DispatchPromptType
  safetyStatus: DispatchSafetyStatus
  blockedReason?: string
  goalId?: string
  selectedGoalKey?: string
  selectedGoalTitle?: string
  selectedReasonDetail?: string
  priority?: EpicPriority
  decisionPolicy?: DecisionPolicy
  autonomyAnchor?: boolean
  hasFixPrompt?: boolean
  generatedAt: string
}

/** Factory Dispatch のスキャン結果。picked=最優先の dispatch 可能 Epic。 */
export interface FactoryDispatchScan {
  /** Factory ON/OFF。false のときは scan せず candidates/blocked は空。 */
  factoryEnabled: boolean
  picked: FactoryDispatchPlan | null
  /** dispatch 可能（safetyStatus=ok）な候補。priority 昇順。 */
  candidates: FactoryDispatchPlan[]
  /** dispatch 不可（blocked）な Epic と理由。 */
  blocked: FactoryDispatchPlan[]
}

/** Dispatch プロンプト生成の応答（プロンプトは生成ビュー。CLI は呼ばない）。 */
export interface DispatchPromptResult {
  plan: FactoryDispatchPlan
  executor: ExecutorChoice
  promptType: DispatchPromptType
  prompt: CodexPrompt | null
}

export interface ApprovalOption {
  key: string
  label: string
  detail?: string
  flag?: 'billing' | 'destructive' | 'secret' | 'external_publish'
}

export interface Approval {
  approvalId: string
  epicId?: string
  title: string
  priority: ApprovalPriority
  category: ApprovalCategory
  options: ApprovalOption[]
  recommended: string
  reason: string
  status: 'pending' | 'decided' | 'expired'
  decidedOption?: string
  decidedBy?: string
  decidedAt?: string
  createdRunId?: string
  createdAt: string
}

export interface OperationalDecision {
  decisionId: string
  epicId?: string
  topic: string
  decision: string
  approvalId?: string
  decidedAt: string
  /** 操作種別: approve / reject / assignGoal / changePriority / markReviewed / pause / drop / factory_pause / factory_resume / goal_adjust 等。 */
  action?: string
  runId?: string
  goalId?: string
  /** 判断主体。human=UI操作 / ai=AI一次レビュー等の自動判断。 */
  source?: 'human' | 'ai'
}

export interface ExecutorSummary {
  executor: ExecutorType
  runnable: number
  running: number
  completedRuns: number
  failedRuns: number
}

export interface NextTodoCandidate {
  sourceRunId: string
  targetApp: string
  title: string
  reviewStatus: string
  createdAt: string
}

export interface PendingTodoGenerationResult {
  created: number
  skipped: number
  taskIds: string[]
  candidates: NextTodoCandidate[]
}

export interface DecisionContext {
  decisions: OperationalDecision[]
  promptBlock: string
  readTiming: string[]
  injectionTargets: string[]
}

export interface GeneratedHandoff {
  source: 'generated'
  objective: string
  currentState: string
  changedFiles: string[]
  remainingWork: string[]
  forbidden: string[]
  checks: string[]
  decisionLog: string[]
  approvalsPending: string[]
  nextActions: NextTodoCandidate[]
  promptBlock: string
  generatedAt: string
}

export interface HandoffSummary {
  exists: boolean
  source: 'today-session' | 'none'
  status: string
  hasStructuredHandoff: boolean
  textLength: number
  updatedAt?: string
  requiredSections: string[]
  missingSections: string[]
}

export interface AutomationReadiness {
  vloopSourceOfTruth: string
  executionTarget: string
  approvalQueue: {
    pending: number
    critical: number
    high: number
    mobileSelectable: number
  }
  decisionLog: {
    entries: number
    latestDecisionAt?: string
  }
  aiGeneratedTodos: {
    fromExecutionRunNextActions: number
    persistedAsTasks: number
    candidates: NextTodoCandidate[]
  }
  executors: ExecutorSummary[]
  handoff: HandoffSummary
  generatedHandoff: {
    available: boolean
    source: string
    nextActions: number
    pendingApprovals: number
  }
  restartReadiness: {
    canResumeFromQueue: boolean
    canResumeFromDecisionLog: boolean
    canFallbackToCodex: boolean
    blockers: string[]
  }
}

export interface HealthSummary {
  runnable: number
  running: number
  pendingApproval: number
  limitWaiting: number
  stopped: number
  epicsActive: number
  stale: number
}

/** Epic 詳細画面（AI工場の主画面）が必要とするデータを既存正本から集約したビュー。新しい正本ではない。 */
export interface EpicDetail {
  epic: Epic
  /** この Epic にひもづく ExecutionRun を絞り込めたか。'epic' = 正確に結合 / 'global-fallback' = 結合キー未整備のため全体の直近を仮表示。 */
  runScope: 'epic' | 'global-fallback'
  /** 前回作業（最新 ExecutionRun） */
  latestRun: ExecutionRunBrief | null
  /** 実行履歴（直近数件） */
  recentRuns: ExecutionRunBrief[]
  /** 決定事項（最新数件 / 全件は /decisions） */
  recentDecisions: OperationalDecision[]
  /** 次回予定（Next Actions） */
  nextActions: NextTodoCandidate[]
  /** この Epic の承認待ち（横断は /approvals） */
  pendingApprovals: Approval[]
  /** Automation 状態（最低限: executor / running / stopped / 承認待ち件数） */
  automation: {
    executors: ExecutorSummary[]
    running: number
    stopped: number
    pendingApproval: number
  }
  /** Factory/Auto Resume の自動実行対象判定（Epic Contract の充足状況）。 */
  factoryEligibility: FactoryEligibility
}

/**
 * Automation（AI工場のエンジン）設定。Claude 上限で止まらないための運用スイッチ。
 * MVP では値の永続化のみ行い、実際の自動実行（Auto Resume / Auto Fallback）の発火は別途実装する。
 */
export interface AutomationConfig {
  /** 既定の実行者。both = Claude 優先・不可なら Codex。 */
  executorMode: 'claude' | 'codex' | 'both'
  /** Claude 上限などで停止したとき、安全な作業を自動で再開するか（enforcement は後続実装）。 */
  autoResume: boolean
  /** Claude が使えないとき、Codex 適格な作業を自動で Codex へ回すか（enforcement は後続実装）。 */
  autoFallback: boolean
  /** Factory 自動運転の ON/OFF。OFF のとき Factory は一切 scan しない。ON のときのみ scan→pick へ進む。 */
  factoryEnabled: boolean
  updatedAt: string
}

/**
 * Codex 引き継ぎプロンプト（半自動切替）。Claude 上限時にユーザーがモバイルでコピーし Codex へ貼る。
 * promptText は単一プレーンテキスト（入れ子コードブロック・長い JSON を含まない）。handoff は内部名で UI には出さない。
 */
export interface CodexPrompt {
  promptText: string
  meta: {
    epicId?: string
    epicTitle?: string
    sourceRunId?: string
    targetApp?: string
    nextActionsCount: number
    approvalsPending: number
    /** 冒頭に Codex 側の安全判定指示を含むか。 */
    hasSafetyGuard: boolean
    generatedAt: string
  }
}

/** Auto Fallback の安全判定でブロックされた理由。優先度の高い順に評価する。 */
export type FallbackBlockKind =
  | 'disabled'            // Auto Fallback OFF / executorMode が both・codex でない
  | 'approval_required'   // 承認待ちあり
  | 'decision_required'   // 決定待ち / decisionPolicy が承認・破壊・予算センシティブ
  | 'requires_approval'   // 対象作業が承認待ち(pending_approval)
  | 'requires_claude'     // 対象作業が Claude 専任
  | 'destructive'         // 危険シグナル(destructive/secret/deploy/...)を含む
  | 'no_codex_candidate'  // Codex 可の安全な作業が残っていない

export interface FallbackBlock {
  kind: FallbackBlockKind
  reason: string
}

/**
 * Auto Fallback（Claude 上限時の半自動 Codex 引き継ぎ）の評価結果。
 * Codex を自動起動はしない。安全なら Codex 用プロンプトを生成して通知表示するだけ。
 */
export interface AutoFallbackResult {
  triggered: boolean
  status: 'codex_ready' | 'blocked'
  fallbackReason: string        // 例: 'claude_rate_limited'
  fallbackTarget: 'codex'
  safetyGuard: boolean          // 生成プロンプト冒頭に安全判定を含むか
  codexPromptGenerated: boolean
  codexPromptSourceRunId?: string
  epicId?: string
  epicTitle?: string
  blocked: FallbackBlock[]
  prompt?: CodexPrompt          // status === 'codex_ready' のときのみ
  evaluatedAt: string
}

/** Automation Log（Auto Fallback / Claude上限検知 / Auto Resume などエンジン側イベントの追記専用ログ）。 */
export interface AutomationLogEntry {
  id: string
  at: string
  event:
    | 'auto_fallback'
    | 'claude_limit_detection'
    | 'auto_resume'
    | 'factory_dispatch'
    | 'ai_review'
    | 'factory_backpressure'
    | 'factory_goal_step_epic_created'
    | 'factory_goal_proposal_requested'
  // --- auto_fallback 用（detection イベントでは未設定可） ---
  fallbackTriggered?: boolean
  fallbackReason?: string
  fallbackTarget?: string
  codexPromptGenerated?: boolean
  codexPromptSourceRunId?: string
  safetyGuard?: boolean
  blockedReason?: string
  epicId?: string
  // --- claude_limit_detection 用 ---
  detectionStatus?: ClaudeLimitDetectionStatus
  detectionConfidence?: ClaudeLimitConfidence
  detectionRecommendation?: ClaudeLimitRecommendation
  signalCount?: number
  signalSources?: LimitSignalSource[]
  // --- auto_resume 用 ---
  resumeState?: AutoResumeState
  resumableCount?: number
  resumeExecutor?: ExecutorType
  resumeRunId?: string
  // --- factory_dispatch 用 ---
  dispatchPlanId?: string
  executorCandidate?: ExecutorChoice
  promptType?: DispatchPromptType
  // --- ai_review 用（一括一次レビューの結果サマリー） ---
  aiReviewCounts?: { processed: number; reviewed: number; needsHuman: number; partial: number; failed: number }
  // --- factory_backpressure 用 ---
  notReviewedCount?: number
  backpressureAction?: 'slow_down' | 'pause'
}

// ---- Auto Resume（Claude 上限後に安全作業だけ自動継続）----
// 新しい正本は作らない。判定は既存の Auto Fallback 安全ゲートを再利用し（feature-toggle ゲートのみ除外）、
// 記録は ExecutionRun + Automation Log に残す。executor 非依存（将来 executor 追加可能な構造）。

export type AutoResumeState = 'running' | 'paused' | 'blocked' | 'auto_resumed'

export interface AutoResumeResult {
  /** Auto Resume 設定が ON か。 */
  autoResumeEnabled: boolean
  state: AutoResumeState
  /** state が running / auto_resumed なら true。 */
  canResume: boolean
  /** 安全に再開できる作業の概算件数。 */
  resumableCount: number
  /** 最後に自動再開した時刻（Automation Log から導出。無ければ未設定）。 */
  lastResumedAt?: string
  /** 再開を担う実行者（rate-limited でない有効 executor）。決まらなければ未設定。 */
  resumeExecutor?: ExecutorType
  /** 安全ゲートでブロックされた理由（feature-toggle の disabled は除外済み）。 */
  blockedReasons: FallbackBlock[]
  /** executor 不在など、ゲート以外の補足ブロック理由。 */
  executorNote?: string
  /** 再開コンテキスト（canResume 時のみ。引き継ぎプロンプト＝新正本ではない生成ビュー）。 */
  resumeContext?: CodexPrompt
  epicId?: string
  epicTitle?: string
  evaluatedAt: string
}

// ---- Claude 上限自動検知（vloop実行ログ / ExecutionRun / Automation Log からの判定）----

export type LimitSignalSource = 'execution-run' | 'vloop-log' | 'automation-log'
export type LimitSignalWeight = 'high' | 'medium' | 'low'

/** 検知の根拠となった 1 シグナル（どのログのどのフィールドが何にマッチしたか）。 */
export interface ClaudeLimitSignal {
  source: LimitSignalSource
  /** runId / vloopログのファイル名 / automation-log の id */
  ref: string
  /** マッチしたフィールド名（'errors' / 'fallbackReason' / 'runStatus' / 'stop_reason' 等） */
  field: string
  /** マッチしたパターンのラベル（例: 'rate limit', '利用制限', 'failed(汎用)'） */
  pattern: string
  /** 根拠テキストの抜粋（機密混入を避けるため短縮） */
  excerpt: string
  weight: LimitSignalWeight
  /** イベント発生時刻（分かる場合） */
  at?: string
}

export type ClaudeLimitDetectionStatus = 'detected' | 'ambiguous' | 'none'
export type ClaudeLimitConfidence = 'high' | 'medium' | 'low' | 'none'
/** trigger_fallback=自動発火 / block_for_review=誤判定回避で人手確認 / no_action=何もしない */
export type ClaudeLimitRecommendation = 'trigger_fallback' | 'block_for_review' | 'no_action'

export interface ClaudeLimitDetection {
  status: ClaudeLimitDetectionStatus
  /** status === 'detected' の糖衣。 */
  detected: boolean
  confidence: ClaudeLimitConfidence
  /** 検知理由（detected 時は 'claude_rate_limited'、ambiguous 時は説明文）。 */
  reason: string
  recommendation: ClaudeLimitRecommendation
  signals: ClaudeLimitSignal[]
  /** 検知に使った時間窓（分）。古い上限イベントの誤発火を避ける。 */
  windowMinutes: number
  evaluatedAt: string
}

/** POST /api/operations/claude-limit の応答。検知 + （推奨時のみ）既存 Auto Fallback 評価結果。 */
export interface ClaudeLimitDetectResponse {
  detection: ClaudeLimitDetection
  /** trigger_fallback 推奨時のみ既存 triggerAutoFallback を実行した結果。 */
  fallback: AutoFallbackResult | null
  autoTriggered: boolean
}

/** Epic 詳細・実行履歴カードで使う ExecutionRun の軽量表現。 */
export interface ExecutionRunBrief {
  runId: string
  finishedAt: string
  targetApp: string
  targetTodoTitle: string
  runStatus: string
  reviewStatus: string
  summary: string
  executor: ExecutorType
  changedFilesCount: number
  nextActions: string[]
}
