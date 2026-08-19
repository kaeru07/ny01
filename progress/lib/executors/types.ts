import type { ExecutorChoice } from '@/lib/types/operations'

// Executor adapter / factory-runner の共通型。
// 完全自動実行は既定で行わない（mode=dry_run が既定）。auto は明示 + 内部安全ガード付きのみ。

export type FactoryRunMode = 'dry_run' | 'manual' | 'auto'

/** 各 adapter が返す共通結果。 */
export interface ExecutorResult {
  status: 'completed' | 'partial' | 'failed' | 'needs_manual'
  stdout: string
  stderr: string
  resultSummary: string
  changedFiles: string[]
  errorType?: string
  rateLimited: boolean
  needsApproval: boolean
  nextActions: string[]
}

export interface ExecutorRunInput {
  epicId: string
  prompt: string
  /** 実行ディレクトリ（既定は対象アプリ or progress リポジトリ）。サンドボックス分離にも使う。 */
  cwd?: string
  timeoutMs?: number
  /** true のとき実起動せず擬似結果を返す（scan/pick/dispatch/record の確認用）。 */
  dryRun: boolean
  /**
   * 安全判定に使う「実際の作業意図」（Epic goal + nextActions 等）。
   * 省略時は prompt を使うが、prompt にはガード文言（課金/削除等の禁止語）が含まれ
   * 誤ブロックするため、runner は意図テキストを渡す。
   */
  safetyText?: string
}

/** 共通 executor adapter インターフェース（claude / codex / manual / 将来追加可能）。 */
export interface ExecutorAdapter {
  name: ExecutorChoice
  run(input: ExecutorRunInput): Promise<ExecutorResult>
}

/** Factory runner の 1 ステップ（= 1 Run）。 */
export interface FactoryRunStep {
  epicId: string
  epicTitle: string
  dispatchPlanId: string
  executor: ExecutorChoice
  result?: ExecutorResult
  recordedRunId?: string
  stopped: boolean
  stopReason?: string
}

/** Factory runner 1 回の起動レポート。 */
export interface FactoryRunReport {
  mode: FactoryRunMode
  factoryEnabled: boolean
  startedAt: string
  finishedAt: string
  /** 1起動あたりの実行件数上限。0 = 無制限（env FACTORY_SAFETY_RUN_LIMIT で設定時のみ有限）。 */
  safetyRunLimit: number
  maxPerEpic: number
  runsExecuted: number
  steps: FactoryRunStep[]
  stoppedReason: string
  /** P4: doneCriteria 達成で完了した Epic の id 一覧（複数 Epic ループの可視化用）。 */
  doneEpics?: string[]
  /** P4: この起動で着手 or スキップ判断した Epic の id 一覧（順序＝遷移順）。 */
  epicsVisited?: string[]
}
