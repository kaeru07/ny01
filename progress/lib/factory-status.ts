import { computeHealthSummary, getAutomationConfig, getAutomationLog } from './operations-store'
import { readJson } from './store'
import { detectClaudeLimit } from './claude-limit-detector'
import { evaluateAutoResume } from './auto-resume'
import { scanFactoryDispatch } from './factory-dispatch'
import { getDoneCriteriaForEpic } from './done-criteria'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { ExecutorType } from './types/operations'
import type { DoneCriteriaEvaluation } from './done-criteria'

// Factory 進行状況（状態中心の派生ビュー / 新しい正本ではない）。
// 既存正本・既存判定（health / config / claude上限検知 / auto resume / dispatch scan / automation log /
// ExecutionRun）を 1 枚に集約する。ユーザーは Executor ではなく「Factory が進行しているか」を見る。

export type FactoryState = '実行中' | '承認待ち' | '停止中' | '再開待ち' | 'Codex準備完了' | 'アイドル'

/** Factory 自動運転の状態（ON/OFF スイッチ前提の 4 状態）。 */
export type FactoryRunState = 'Running' | 'Paused' | 'Blocked' | 'CodexReady'

export interface FactoryStatusSummary {
  state: FactoryState
  /** Factory ON/OFF スイッチ（factoryEnabled）。 */
  factoryEnabled: boolean
  /** Factory 自動運転状態（Running / Paused / Blocked / CodexReady）。 */
  factoryRunState: FactoryRunState
  /** 自動運転（Factory ON）か。factoryEnabled と同値。 */
  factoryOn: boolean
  autoFallback: boolean
  autoResume: boolean
  /** 現在実行中 / 次に実行予定の Epic タイトル。 */
  currentEpic: string | null
  /** 参考表示の実行者（内部状態。ユーザーは意識しなくてよい）。 */
  executor: ExecutorType
  executorMode: 'claude' | 'codex' | 'both'
  /** Claude 利用状況（none=正常 / detected=上限 / ambiguous=要確認）。 */
  claudeStatus: 'none' | 'detected' | 'ambiguous'
  lastRunAt?: string
  lastFallbackAt?: string
  fallbackReason?: string
  fallbackStatus?: 'codex_ready' | 'blocked'
  runnable: number
  pendingApproval: number
  stopped: number
  stopReason?: string
  nextPlanned: string | null
  /** picked Epic の doneCriteria 自動判定（無ければ null）。 */
  pickedDoneCriteria: DoneCriteriaEvaluation | null
}

export async function computeFactoryStatus(): Promise<FactoryStatusSummary> {
  const [health, config, alog, detection, resume, scan, runsData] = await Promise.all([
    computeHealthSummary(),
    getAutomationConfig(),
    getAutomationLog(20),
    detectClaudeLimit(),
    evaluateAutoResume(),
    scanFactoryDispatch(),
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
  ])

  const lastFallback = alog.find((e) => e.event === 'auto_fallback')
  const runs = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  const lastRun = runs[0]
  const factoryOn = config.factoryEnabled
  const codexReady =
    Boolean(lastFallback?.codexPromptGenerated) || (detection.status === 'detected' && resume.canResume)

  // Factory 自動運転状態（OFF=Paused / 上限&Codex可=CodexReady / 候補あり=Running / 候補なし=Blocked）
  let factoryRunState: FactoryRunState
  if (!config.factoryEnabled) {
    factoryRunState = 'Paused'
  } else if (detection.status === 'detected' && codexReady) {
    factoryRunState = 'CodexReady'
  } else if (scan.candidates.length > 0) {
    factoryRunState = 'Running'
  } else {
    factoryRunState = 'Blocked'
  }

  let state: FactoryState
  let stopReason: string | undefined

  // 表示優先順位: 実行中 > 承認待ち > 停止中 > 再開待ち > Codex準備完了
  if (health.running > 0) {
    state = '実行中'
  } else if (health.pendingApproval > 0) {
    state = '承認待ち'
  } else if (!factoryOn) {
    state = '停止中'
    stopReason = '自動運転（Auto Resume / Auto Fallback）が OFF'
  } else if (detection.status === 'detected' && !resume.canResume) {
    state = '再開待ち'
    stopReason =
      resume.executorNote ??
      (resume.blockedReasons.map((b) => b.reason).join(' / ') || 'Claude 上限・再開条件待ち')
  } else if (codexReady) {
    state = 'Codex準備完了'
  } else if (health.runnable > 0 || scan.candidates.length > 0) {
    state = 'アイドル'
  } else {
    state = '停止中'
    stopReason = '実行可能な作業がありません'
  }

  return {
    state,
    factoryEnabled: config.factoryEnabled,
    factoryRunState,
    factoryOn,
    autoFallback: config.autoFallback,
    autoResume: config.autoResume,
    currentEpic: scan.picked?.epicTitle ?? null,
    executor: resume.resumeExecutor ?? (config.executorMode === 'codex' ? 'codex' : 'claude'),
    executorMode: config.executorMode,
    claudeStatus: detection.status,
    lastRunAt: lastRun?.finishedAt,
    lastFallbackAt: lastFallback?.at,
    fallbackReason: lastFallback?.fallbackReason,
    fallbackStatus: lastFallback ? (lastFallback.codexPromptGenerated ? 'codex_ready' : 'blocked') : undefined,
    runnable: health.runnable + scan.candidates.length,
    pendingApproval: health.pendingApproval,
    stopped: health.stopped,
    stopReason,
    nextPlanned: scan.picked ? `${scan.picked.epicTitle}（${scan.picked.selectedReason}）` : null,
    pickedDoneCriteria: scan.picked ? await getDoneCriteriaForEpic(scan.picked.epicId) : null,
  }
}
