import { computeHealthSummary, getAutomationConfig, getAutomationLog } from './operations-store'
import { readJson } from './store'
import { detectClaudeLimit } from './claude-limit-detector'
import { evaluateAutoResume } from './auto-resume'
import { scanFactoryDispatch } from './factory-dispatch'
import { getDoneCriteriaForEpic } from './done-criteria'
import { getAutoQueueView } from './auto-queue'
import type { ExecutionRunsData } from '@/types/execution-run'
import type { ExecutorType } from './types/operations'
import type { DoneCriteriaEvaluation } from './done-criteria'

// Factory 進行状況（状態中心の派生ビュー / 新しい正本ではない）。
// 既存正本・既存判定（health / config / claude上限検知 / auto resume / dispatch scan / automation log /
// ExecutionRun）を 1 枚に集約する。ユーザーは Executor ではなく「Factory が進行しているか」を見る。

export type FactoryState = '実行中' | '承認待ち' | '停止中' | '再開待ち' | 'Codex準備完了' | 'アイドル'

export interface FactoryStatusSummary {
  state: FactoryState
  /** Factory ON/OFF スイッチ（factoryEnabled）。 */
  factoryEnabled: boolean
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
  /** 直近の定時起動結果。過去の停止ログと現在状態を区別するために使う。 */
  lastScheduleAttempt: {
    runId: string
    finishedAt: string
    blocked: boolean
    summary: string
  } | null
  /** 現在の停止状態を解消するための具体的な導線。Running のときは空。 */
  recoveryActions: Array<{
    label: string
    href: string
    detail: string
  }>
  /** picked Epic の doneCriteria 自動判定（無ければ null）。 */
  pickedDoneCriteria: DoneCriteriaEvaluation | null
}

export async function computeFactoryStatus(): Promise<FactoryStatusSummary> {
  const [health, config, alog, detection, resume, scan, runsData, autoQueue] = await Promise.all([
    computeHealthSummary(),
    getAutomationConfig(),
    getAutomationLog(20),
    detectClaudeLimit(),
    evaluateAutoResume(),
    scanFactoryDispatch(),
    readJson<ExecutionRunsData>('execution-runs.json', { runs: [] }),
    getAutoQueueView(),
  ])

  const lastFallback = alog.find((e) => e.event === 'auto_fallback')
  const runs = [...runsData.runs].sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
  const lastRun = runs[0]
  const lastScheduleRun = runs.find(
    (run) => run.source === 'schedule' || String(run.targetTodoTitle ?? '').includes('Factory schedule'),
  )
  const factoryOn = config.factoryEnabled
  const codexReady =
    Boolean(lastFallback?.codexPromptGenerated) || (detection.status === 'detected' && resume.canResume)

  // Epic がまだ無くても、実行可能 Goal があれば runFactory が「次の一歩」Epicを生成できる。
  // ここで Blocked にすると、その生成処理へ到達する前にスケジューラが停止してしまう。
  const runnableQueueCount = autoQueue.executable.length
  const nextQueueItem = autoQueue.next

  let state: FactoryState
  let stopReason: string | undefined

  // 承認待ちは該当作業だけを止める。別の安全な候補があれば Factory 全体は停止扱いにしない。
  if (health.running > 0) {
    state = '実行中'
  } else if (health.pendingApproval > 0 && scan.candidates.length === 0 && runnableQueueCount === 0) {
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
  } else if (health.runnable > 0 || scan.candidates.length > 0 || runnableQueueCount > 0) {
    state = 'アイドル'
  } else {
    state = '停止中'
    if (autoQueue.waitingUser.length > 0) {
      stopReason = `ユーザー判断待ちが ${autoQueue.waitingUser.length} 件あります`
    } else if (autoQueue.blocked.length > 0) {
      stopReason = `ブロック中の作業が ${autoQueue.blocked.length} 件あります`
    } else if (autoQueue.manual.length > 0) {
      stopReason = `手動対応または自動実行対象外の作業だけが ${autoQueue.manual.length} 件あります`
    } else {
      stopReason = '実行可能な作業がありません'
    }
  }

  const recoveryActions: FactoryStatusSummary['recoveryActions'] = []
  if (!factoryOn) {
    recoveryActions.push({
      label: 'FactoryをONにする',
      href: '/automation',
      detail: 'AutomationでFactoryを開始してください。',
    })
  } else if (detection.status === 'detected' && !resume.canResume) {
    recoveryActions.push({
      label: '実行者の再開条件を確認',
      href: '/automation',
      detail: resume.executorNote ?? 'Claude上限または代替実行者の状態を確認してください。',
    })
  } else if (state === '停止中') {
    if (autoQueue.waitingUser.length > 0 || health.pendingApproval > 0) {
      recoveryActions.push({
        label: '判断待ちを解消',
        href: '/decide',
        detail: `判断・承認待ちを処理してください（現在 ${Math.max(autoQueue.waitingUser.length, health.pendingApproval)} 件）。`,
      })
    }
    if (autoQueue.blocked.length > 0) {
      recoveryActions.push({
        label: 'ブロック理由を見る',
        href: '/queue?status=blocked',
        detail: `ブロック中 ${autoQueue.blocked.length} 件の「こうすれば動きます」を確認してください。`,
      })
    }
    if (autoQueue.manual.length > 0) {
      recoveryActions.push({
        label: '対象外設定を確認',
        href: '/queue?status=manual',
        detail: `手動・対象外 ${autoQueue.manual.length} 件の decisionPolicy / factoryEligible を確認してください。`,
      })
    }
    if (
      autoQueue.executable.length === 0 &&
      autoQueue.waitingUser.length === 0 &&
      autoQueue.blocked.length === 0 &&
      autoQueue.manual.length === 0
    ) {
      recoveryActions.push({
        label: '自動実行するゴールを追加',
        href: '/goal-planner',
        detail: '未達成のactiveゴール、または自動実行可能なEpicを追加してください。',
      })
    }
  }

  return {
    state,
    factoryEnabled: config.factoryEnabled,
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
    runnable: health.runnable + scan.candidates.length + runnableQueueCount,
    pendingApproval: health.pendingApproval,
    stopped: health.stopped,
    stopReason,
    nextPlanned: scan.picked
      ? `${scan.picked.epicTitle}（${scan.picked.selectedReason}）`
      : nextQueueItem
        ? `${nextQueueItem.title}（${nextQueueItem.reason}）`
        : null,
    lastScheduleAttempt: lastScheduleRun
      ? {
          runId: lastScheduleRun.runId,
          finishedAt: lastScheduleRun.finishedAt,
          blocked:
            lastScheduleRun.stopReason === 'blocked' ||
            String(lastScheduleRun.summary ?? '').includes('factoryRunState=Blocked'),
          summary: lastScheduleRun.summary,
        }
      : null,
    recoveryActions,
    pickedDoneCriteria: scan.picked ? await getDoneCriteriaForEpic(scan.picked.epicId) : null,
  }
}
