export type RunStatus = 'running' | 'completed' | 'failed' | 'partial'
/** needs_human: AI一次レビューが「人間判断が必要」と振り分けた状態（意思決定キュー行き）。
 *  snoozed: 人間が「あとで」を選んだ後回し状態。レビュー待ち一覧には残すが「あとで」として区別表示する。 */
export type ReviewStatus = 'not_reviewed' | 'copied' | 'reviewed' | 'needs_followup' | 'needs_human' | 'snoozed'
export type ExecutorType = 'claude' | 'codex' | 'manual' | 'other'

/** AI一次レビュー（ルールベース・LLM不使用）の判定結果。reviewStatus とは独立に判定根拠を保持する。 */
export type AiReviewVerdict = 'reviewed' | 'needs_human' | 'partial' | 'failed'

export interface AiReviewResult {
  verdict: AiReviewVerdict
  /** 判定理由（人間が読める1行）。reviewMemo にも同内容を追記する。 */
  reason: string
  /** 発火した判定ルールの識別子（例: clean_completed / risk_keyword / run_failed）。 */
  rule: string
  reviewedAt: string
}

export interface ChangedFile {
  file: string
  change: string
}

export interface CheckResult {
  build?: string
  typescript?: string
  lint?: string
  mainScreen?: string
  mobileLayout?: string
  // backward compat — old field names
  mainScreens?: string
  iphone?: string
  [key: string]: string | undefined
}

export interface ExecutionRun {
  runId: string
  startedAt: string
  finishedAt: string
  targetApp: string
  /** 任意。executor が Epic に紐付く Run を POST するとき指定する。未指定 Run は targetApp / targetTodoId でフォールバック結合する。 */
  epicId?: string
  targetTodoId?: string
  targetTodoTitle: string
  runStatus: RunStatus
  reviewStatus: ReviewStatus
  reviewMemo?: string
  reviewedAt?: string
  /** AI一次レビューの判定結果（実施済みの場合のみ）。 */
  aiReview?: AiReviewResult
  /** 任意。Run の発生源。例: 'codex_mobile'（Codexモバイルで実行しProgressへ手動で戻したRun）/
   *  'factory_runner'（Factory が生成）/ 'schedule'（定時実行）/ 'boot'（VPS 起動時）。 */
  source?: string
  /** 修正依頼を受けて実行された Run の場合、修正元のExecutionRun。 */
  followupOfRunId?: string
  /** 任意。スケジュール起動のトリガ手段。'systemd' / 'cron' / 'startup'。 */
  trigger?: string
  executorUsed?: ExecutorType
  preferredExecutor?: ExecutorType
  fallbackExecutor?: ExecutorType
  autoFallback?: boolean
  fallbackReason?: string
  // 任意。Factory Dispatch（手動コピー運用）でこの Run が生成/戻された場合のメタ。
  factoryDispatch?: boolean
  /** 例: 'manual_copy'（完全自動ではなくユーザーがコピーして実行）。 */
  dispatchMode?: string
  dispatchPlanId?: string
  executorCandidate?: ExecutorType
  promptGenerated?: boolean
  resultReturned?: boolean
  /** factory-runner が生成した Run か。 */
  factoryRun?: boolean
  /** runner のモード（dry_run / manual / auto）。 */
  runnerMode?: string
  /** Factory 起動内での 1 始まり Run 番号。 */
  runIndex?: number
  /** この Run 後の doneCriteria 判定（done / continue）。 */
  doneCriteriaStatus?: string
  /** この Run の停止理由（epic_done / max_runs_reached / blocked など）。 */
  stopReason?: string
  /** 次アクション件数（= 未達 doneCriteria 件数）。 */
  nextActionCount?: number
  beforeStatus?: string
  afterStatus?: string
  promptUsed?: string
  summary: string
  changedFiles: ChangedFile[]
  checks: CheckResult
  errors: string[]
  warnings: string[]
  progressUpdated: boolean
  nextActions: string[]
  rawReport: string
}

export interface ExecutionRunsData {
  runs: ExecutionRun[]
}
