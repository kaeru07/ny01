import { computeFactoryStatus } from './factory-status'
import { getFactoryScheduleStatus } from './factory-schedule-status'
import { readJson } from './store'
import type { ExecutionRunsData, ExecutionRun } from '@/types/execution-run'

// factory-overview: 「Factory状態カード」専用の読み取り専用ビュー。
// 既存の computeFactoryStatus / schedule-status / ExecutionRun を集約し、
// 一般ユーザー向けの表現（実行中 / 停止中 / Claude / Codex / 次回起動 / 停止理由）に整形する。
// Factory ロジック・安全ゲート・doneCriteria・切替ロジックには一切触らない（読むだけ）。

/** ユーザー向け Factory 状態（要件の 6 区分）。 */
export type FactoryDisplayState =
  | 'OFF'
  | 'Running'
  | 'Blocked'
  | 'Approval Required'
  | 'Codex Ready'
  | 'Paused'

export type ExecutorDisplay = 'Claude' | 'Codex' | 'None'
export type LaunchMethod = 'Manual' | 'Schedule' | 'Boot'

export interface FactoryLastRun {
  runId: string | null
  finishedAt: string | null
  executorUsed: ExecutorDisplay
  /** スケジュール起動なら source（schedule/boot）、それ以外は manual 扱い。 */
  launchMethod: LaunchMethod
}

export interface FactoryOverview {
  /** ユーザー向け状態。 */
  state: FactoryDisplayState
  /** Factory ON/OFF。 */
  factoryEnabled: boolean
  /** 実行中 / 次に処理予定の Epic タイトル（無ければ null）。 */
  currentEpic: string | null
  /** 今の実行者（Claude / Codex / None）。 */
  executor: ExecutorDisplay
  /** 次回起動時刻（ISO / 未設定なら null）。 */
  nextRunAt: string | null
  /** 直近 Run の起動方式（Manual / Schedule / Boot）。 */
  launchMethod: LaunchMethod
  /** 最終 Run。 */
  lastRun: FactoryLastRun
  /** 停止 / 待機理由（ユーザー向け短文。無ければ null）。 */
  stopReason: string | null
  /** Claude 利用状況。 */
  claude: 'Available' | 'Rate Limited' | 'Unknown'
  /** Codex 待機状況。 */
  codex: 'Ready' | 'Unavailable'
  /** AutoFallback 設定。 */
  autoFallback: boolean
  /** スケジュール設定。 */
  schedule: {
    timerEnabled: boolean
    bootEnabled: boolean
    dailyTime: string | null
  }
}

function executorOf(run: ExecutionRun | undefined): ExecutorDisplay {
  const e = run?.executorUsed
  if (e === 'claude') return 'Claude'
  if (e === 'codex') return 'Codex'
  return 'None'
}

function launchOf(run: ExecutionRun | undefined): LaunchMethod {
  if (run?.source === 'boot') return 'Boot'
  if (run?.source === 'schedule') return 'Schedule'
  return 'Manual'
}

/**
 * 停止理由を「なぜ止まったか」が一般ユーザーに分かる日本語へ正規化する。
 * 既存 stopReason（自由文 / 既知キー）を表示語にマップ。未知はそのまま短く返す。
 */
function humanStopReason(state: FactoryDisplayState, raw?: string | null): string | null {
  if (state === 'Running') return null
  if (!raw) {
    if (state === 'OFF') return 'Factory が OFF です'
    return null
  }
  const r = raw.toLowerCase()
  if (r.includes('factory_off') || r.includes('off')) return 'Factory が OFF です'
  if (r.includes('approval')) return '承認待ちのため停止中です'
  if (r.includes('blocked')) return '実行できる作業がなく停止中です'
  if (r.includes('max_runs') || r.includes('max_per_epic')) return '1回の上限まで実行して停止しました'
  if (r.includes('rate_limited') || r.includes('claude_rate')) return 'Claude が上限に達しました'
  if (r.includes('done')) return 'doneCriteria を達成して完了しました'
  if (r.includes('run_failed') || r.includes('fail')) return '実行が失敗して停止しました'
  // 既存 computeFactoryStatus の自由文（「自動運転（…）が OFF」等）はそのまま返す。
  return raw
}

export async function getFactoryOverview(): Promise<FactoryOverview> {
  const [status, schedule, runsData] = await Promise.all([
    computeFactoryStatus(),
    getFactoryScheduleStatus(),
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
  ])

  // 最終 Run（finishedAt 降順の先頭）。
  const sortedRuns = [...runsData.runs].sort(
    (a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt),
  )
  const lastRunRaw = sortedRuns[0]

  // 具体的な観測値から表示状態を決める。合成状態を実行ゲートには使わない。
  let state: FactoryDisplayState
  if (!status.factoryEnabled) {
    state = 'OFF'
  } else if (status.state === 'Codex準備完了') {
    state = 'Codex Ready'
  } else if (status.state === '実行中' || status.runnable > 0) {
    state = 'Running'
  } else if (status.pendingApproval > 0) {
    state = 'Approval Required'
  } else if (status.state === '停止中') {
    state = 'Blocked'
  } else {
    state = 'Paused'
  }

  // 今の実行者: 実行中 Epic があり Running なら status.executor を採用、それ以外は最終 Run の executor。
  let executor: ExecutorDisplay
  if (state === 'Running') {
    executor = status.executor === 'codex' ? 'Codex' : 'Claude'
  } else if (state === 'Codex Ready') {
    executor = 'Codex'
  } else {
    executor = executorOf(lastRunRaw)
  }

  const claude: FactoryOverview['claude'] =
    status.claudeStatus === 'detected'
      ? 'Rate Limited'
      : status.claudeStatus === 'none'
        ? 'Available'
        : 'Unknown'

  // Codex 待機: CodexReady 状態 or AutoFallback ON かつ both/codex モードなら Ready。
  const codexCapable =
    status.executorMode === 'both' || status.executorMode === 'codex'
  const codex: FactoryOverview['codex'] =
    status.state === 'Codex準備完了' || (status.autoFallback && codexCapable)
      ? 'Ready'
      : 'Unavailable'

  return {
    state,
    factoryEnabled: status.factoryEnabled,
    currentEpic: status.currentEpic,
    executor,
    nextRunAt: schedule.nextRunAt,
    launchMethod: launchOf(lastRunRaw),
    lastRun: {
      runId: lastRunRaw?.runId ?? null,
      finishedAt: lastRunRaw?.finishedAt ?? null,
      executorUsed: executorOf(lastRunRaw),
      launchMethod: launchOf(lastRunRaw),
    },
    stopReason: humanStopReason(state, status.stopReason ?? lastRunRaw?.stopReason),
    claude,
    codex,
    autoFallback: status.autoFallback,
    schedule: {
      timerEnabled: schedule.timerEnabled,
      bootEnabled: schedule.bootEnabled,
      dailyTime: schedule.dailyTime,
    },
  }
}
