import {
  getAutomationConfig,
  getEpicDetail,
  getEpics,
  getPendingApprovals,
  generateCodexPrompt,
  createApproval,
  appendAutomationLog,
  updateEpic,
} from './operations-store'
import { scanFactoryDispatch, buildDispatchPlan, generateClaudeFactoryPrompt } from './factory-dispatch'
import { buildAutoQueue } from './auto-queue'
import { ensureNextGoalStepEpic } from './goal-step-epic'
import { requestGoalProposalIfIdle } from './goal-proposal'
import { proposeGoalsFromResearchIfNeeded } from './research-goals'
import { proposeImprovementGoalsIfIdle } from './improvement-goals'
import { addExecutionRun, updateExecutionRunFields } from './execution-run-writer'
import { ensureExecutionRunNextActions } from './execution-run-next-actions'
import { readExecutionRuns } from './execution-run-reader'
import { runAiReviewBatch } from '@/lib/ai-review'
import { normalizeExecutionRunErrors } from './execution-run-errors'
import { readGoals } from './goal-reader'
import { writeGoals } from './goal-writer'
import { resolveAppCwd } from './app-paths'
import { triggerProgressSelfHealIfNeeded } from './progress-self-heal'
import { recordUrgentIssues } from './urgent-issues'
import { ensureBlockedDecisions } from './blocked-decisions'
import { DANGER_CATEGORIES, isReviewApprovalOptions } from './inbox-labels'
import { getAdapter } from './executors'
import { decideCodexFallback } from './executor-fallback'
import { runChecks, failingChecks, gateRunStatusByChecks } from './checks-runner'
import { selectSkillForEpic } from './skill-select'
import { hasFixRequestedForEpic } from './auto-queue-score'
import type { ChecksRunResult } from './checks-runner'
import { getDoneCriteriaForEpic } from './done-criteria'
import type { FactoryRunMode, FactoryRunReport, FactoryRunStep, ExecutorResult } from './executors/types'
import type { ExecutionRun } from '@/types/execution-run'
import type { ExecutorChoice, FactoryDispatchPlan } from './types/operations'

// factory-runner: scan→pick→Dispatch→（adapter で）Run→ExecutionRun 記録→次へ。
// 安全第一: 既定は dry_run（実起動なし）。caps（maxRuns / maxPerEpic）で無限ループを防ぐ。
// auto は明示時のみ。Dispatch判定のexecutorを起動し、Claude上限時はCodexへfallbackする。
// 禁止: 無限ループ / 危険作業の Codex 委譲 / Approval・Decision 待ちの実行 / チャットで質問停止。

const OPEN_EPIC_STATUSES = new Set(['active', 'approved', 'paused'])
const STALE_NOCHANGE_LIMIT = 3

interface RunnerOptions {
  mode?: FactoryRunMode
  maxRuns?: number
  maxPerEpic?: number
  /** auto モードを実起動するための明示確認。false/未指定なら auto でも実起動しない。 */
  confirm?: boolean
  /** テスト用: Claude を実起動せず rate_limit を擬似発生させ、Codex fallback 経路を検証する。 */
  simulateRateLimit?: boolean
  /** テスト用: この Run 番号（1 始まり）以降だけ rate_limit を擬似発生させる（例: 2 で Run1=Claude / Run2=Codex）。 */
  simulateRateLimitFromRun?: number
  /** テスト用: rate_limit 発生前の Claude Run を実起動せず成功扱いにする。 */
  simulateClaudeSuccessBeforeRateLimit?: boolean
  /** テスト用: fallback 後の Codex Run を実起動せず成功扱いにする。 */
  simulateCodexSuccessAfterFallback?: boolean
  /** executor / checks の実行ディレクトリ（既定 process.cwd()）。サンドボックス分離に使う。 */
  cwd?: string
}

function generateRunId(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${String(now.getMilliseconds()).padStart(3, '0')}`
}

async function generateUniqueRunId(): Promise<string> {
  const existing = new Set((await readExecutionRuns()).map((r) => r.runId))
  const base = generateRunId()
  if (!existing.has(base)) return base
  let i = 1
  while (existing.has(`${base}-${i}`)) i += 1
  return `${base}-${i}`
}

function extractFollowupOfRunId(notes?: string): string | undefined {
  const match = notes?.match(/followupOfRunId=([A-Za-z0-9._:-]+)/)
  return match?.[1]
}

function selectionFromPlan(plan: FactoryDispatchPlan): ExecutionRun['selection'] {
  const selectedAt = new Date().toISOString()
  return {
    selectedGoalKey: plan.selectedGoalKey ?? plan.goalId ?? 'unassigned',
    selectedGoalTitle: plan.selectedGoalTitle ?? plan.goal,
    selectedWorkItemId: `epic:${plan.epicId}`,
    selectedReason: plan.selectedReasonDetail ?? plan.selectedReason,
    priority: plan.priority,
    decisionPolicy: plan.decisionPolicy,
    riskFlags: plan.riskFlags,
    hasFixPrompt: plan.hasFixPrompt === true,
    selectedAt,
  }
}

async function resolveSkillForRun(args: { epicId: string; targetApp: string }): Promise<Pick<ExecutionRun, 'skillId' | 'skillVersion'>> {
  try {
    const [epic, runs] = await Promise.all([
      getEpics().then((epics) => epics.find((item) => item.epicId === args.epicId)),
      readExecutionRuns(),
    ])
    const selectableEpic = epic
      ? { ...epic, targetApp: epic.targetApp ?? args.targetApp, targetApps: epic.targetApps ?? [args.targetApp] }
      : { epicId: args.epicId, targetApp: args.targetApp }
    const selected = await selectSkillForEpic(selectableEpic, {
      fixRequested: hasFixRequestedForEpic(selectableEpic, runs),
    })
    if (!selected) return {}
    return { skillId: selected.skill.id, skillVersion: selected.version }
  } catch (err) {
    console.warn('skill mapping failed:', err)
    return {}
  }
}

async function updateGoalSelectionPointer(selection: ExecutionRun['selection'] | undefined, runId: string): Promise<void> {
  if (!selection?.selectedGoalKey || selection.selectedGoalKey === 'unassigned') return
  const data = await readGoals()
  const idx = data.goals.findIndex((goal) => goal.id === selection.selectedGoalKey)
  if (idx === -1) return
  data.goals[idx] = {
    ...data.goals[idx],
    lastSelectedRunId: runId,
    lastSelectedAt: selection.selectedAt,
    updatedAt: new Date().toISOString(),
  }
  await writeGoals(data)
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function runAiReviewBatchSafely(context: string): Promise<void> {
  try {
    await runAiReviewBatch(10)
  } catch (err) {
    const message = `AI一次レビュー失敗(${context}): ${errorMessage(err)}`
    console.warn(message, err)
    try {
      await appendAutomationLog({ event: 'ai_review', fallbackReason: message })
    } catch (logErr) {
      console.warn('AI一次レビュー失敗ログの記録に失敗:', logErr)
    }
  }
}

async function detectGoalstepStaleNoChange(args: {
  epicId: string
  epicTitle: string
  recordedRunId: string
}): Promise<boolean> {
  if (!args.epicId.startsWith('epic-goalstep-')) return false

  const runs = (await readExecutionRuns()).filter((run) => run.epicId === args.epicId)
  const latest = runs.slice(0, STALE_NOCHANGE_LIMIT)
  if (latest.length < STALE_NOCHANGE_LIMIT) return false

  const stale = latest.every((run) => (run.changedFiles ?? []).length === 0 && run.doneCriteriaStatus !== 'done')
  if (!stale) return false

  const pendingApprovals = await getPendingApprovals()
  const exists = pendingApprovals.some((approval) => approval.epicId === args.epicId && approval.status === 'pending')
  if (!exists) {
    await createApproval({
      epicId: args.epicId,
      title: `ゴール手詰まり/完了確認: ${args.epicTitle}`,
      category: 'multi_option',
      priority: 'normal',
      options: [
        { key: 'mark_done', label: 'このゴールは完了にする' },
        { key: 'continue', label: '続行する（まだやることがある）' },
        { key: 'hold', label: '保留する' },
      ],
      recommended: 'mark_done',
      reason: `同一ゴールの「次の一歩」が${STALE_NOCHANGE_LIMIT}回連続で変更ゼロ。実質完了か手詰まりの可能性。今日の判断で方針を決めてください。`,
      createdRunId: args.recordedRunId,
    })
  }

  await appendAutomationLog({
    event: 'factory_backpressure',
    epicId: args.epicId,
    fallbackReason: `goalstep変更ゼロ${STALE_NOCHANGE_LIMIT}回連続を検知: ${args.epicTitle}`,
    backpressureAction: 'pause',
  })
  return true
}

export async function propagateEpicDoneToGoal(epicId: string, goalId?: string): Promise<void> {
  if (!goalId) return
  // アプリ作成ゴール(goal-app-*)は1つの「次の一歩」Epic完了で閉じない。
  // 4フェーズ(基盤→機能完成→品質仕上げ→公開準備)を次のstep epicで継続し、
  // 完了は人間の確認(手詰まり確認のmark_done / 達成確認)経由でのみ行う。
  if (goalId.startsWith('goal-app-')) return
  const [epics, goalsData] = await Promise.all([getEpics(), readGoals()])
  const goal = goalsData.goals.find((g) => g.id === goalId)
  if (!goal || goal.status !== 'active') return

  const hasOtherOpenEpic = epics.some((epic) => (
    epic.goalId === goalId &&
    epic.epicId !== epicId &&
    OPEN_EPIC_STATUSES.has(epic.status)
  ))
  const hasOpenAutoTodo = goal.todos.some((todo) => (
    todo.role !== 'human' &&
    todo.status !== 'done' &&
    todo.status !== 'skipped'
  ))
  if (hasOtherOpenEpic || hasOpenAutoTodo) return

  const now = new Date().toISOString()
  goal.status = 'done'
  goal.current = typeof goal.target === 'number' ? goal.target : goal.current
  goal.updatedAt = now
  await writeGoals(goalsData)
}

async function recordRun(args: {
  epicId: string
  targetApp: string
  title: string
  executor: ExecutorChoice
  mode: FactoryRunMode
  dispatchPlanId: string
  result: ExecutorResult
  checks?: ChecksRunResult
  runIndex?: number
  followupOfRunId?: string
  /** fallback で Codex に切替えた Run には claude_rate_limited を残す。 */
  fallbackReason?: string
  /** この Run で即停止した場合の理由。 */
  stopReason?: string
  selection?: ExecutionRun['selection']
}): Promise<string> {
  const runId = await generateUniqueRunId()
  const now = new Date().toISOString()
  const runStatusMap: Record<ExecutorResult['status'], ExecutionRun['runStatus']> = {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    needs_manual: 'running',
  }
  // lint ゲート: checks に NG があれば completed を partial へ格下げ（lint NG を完了扱いにしない）。
  const ngChecks = failingChecks(args.checks)
  const gatedRunStatus = gateRunStatusByChecks(runStatusMap[args.result.status], args.checks)
  const checkWarnings = gatedRunStatus !== runStatusMap[args.result.status]
    ? [`lintゲート: checks NG（${ngChecks.join(' / ')}）のため completed→partial に格下げ。要修正/レビュー待ち。`]
    : []
  const rawReport = `[factory-runner ${args.mode}] executor=${args.executor}\n${args.result.stdout || args.result.resultSummary}`
  const errors = normalizeExecutionRunErrors(args.result.stderr ? [args.result.stderr.slice(0, 500)] : [])
  const nextActions = ensureExecutionRunNextActions({
    nextActions: args.result.nextActions,
    rawReport,
    runStatus: gatedRunStatus,
    stopReason: args.stopReason,
    summary: args.result.resultSummary,
    targetTodoTitle: args.title,
    errors,
  })
  const skillFields = await resolveSkillForRun({ epicId: args.epicId, targetApp: args.targetApp })
  const run: ExecutionRun = {
    runId,
    startedAt: now,
    finishedAt: now,
    targetApp: args.targetApp,
    epicId: args.epicId,
    ...skillFields,
    targetTodoTitle: args.title,
    runStatus: gatedRunStatus,
    reviewStatus: 'not_reviewed',
    source: 'factory_runner',
    followupOfRunId: args.followupOfRunId,
    executorUsed: args.executor,
    factoryRun: true,
    runnerMode: args.mode,
    factoryDispatch: true,
    dispatchMode: args.mode === 'auto' ? 'auto' : 'manual_copy',
    dispatchPlanId: args.dispatchPlanId,
    executorCandidate: args.executor,
    promptGenerated: true,
    resultReturned: args.mode === 'auto',
    fallbackReason: args.fallbackReason ?? (args.result.rateLimited ? 'claude_rate_limited' : undefined),
    runIndex: args.runIndex,
    stopReason: args.stopReason,
    selection: args.selection,
    nextActionCount: nextActions.length,
    summary: args.result.resultSummary,
    changedFiles: args.result.changedFiles.map((f) => ({ file: f, change: '' })),
    checks: args.checks ?? {},
    errors,
    warnings: checkWarnings,
    progressUpdated: false,
    nextActions,
    rawReport,
  }
  await addExecutionRun(run)
  await updateGoalSelectionPointer(args.selection, runId)
  return runId
}

async function startRunningRun(args: {
  epicId: string
  targetApp: string
  title: string
  executor: ExecutorChoice
  mode: FactoryRunMode
  dispatchPlanId: string
  runIndex?: number
  followupOfRunId?: string
  selection?: ExecutionRun['selection']
}): Promise<string> {
  const runId = await generateUniqueRunId()
  const now = new Date().toISOString()
  const skillFields = await resolveSkillForRun({ epicId: args.epicId, targetApp: args.targetApp })
  const run: ExecutionRun = {
    runId,
    startedAt: now,
    finishedAt: now,
    targetApp: args.targetApp,
    epicId: args.epicId,
    ...skillFields,
    targetTodoTitle: args.title,
    runStatus: 'running',
    reviewStatus: 'not_reviewed',
    source: 'factory_runner',
    followupOfRunId: args.followupOfRunId,
    executorUsed: args.executor,
    factoryRun: true,
    runnerMode: args.mode,
    factoryDispatch: true,
    dispatchMode: 'auto',
    dispatchPlanId: args.dispatchPlanId,
    executorCandidate: args.executor,
    promptGenerated: true,
    resultReturned: false,
    runIndex: args.runIndex,
    selection: args.selection,
    summary: 'AI工場が作業中です',
    changedFiles: [],
    checks: {},
    errors: [],
    warnings: [],
    progressUpdated: false,
    nextActions: [],
    rawReport: `[factory-runner ${args.mode}] started executor=${args.executor}`,
  }
  await addExecutionRun(run)
  await updateGoalSelectionPointer(args.selection, runId)
  return runId
}

async function finishRunningRun(args: {
  runId: string
  executor: ExecutorChoice
  mode: FactoryRunMode
  result: ExecutorResult
  checks?: ChecksRunResult
  fallbackReason?: string
  stopReason?: string
}): Promise<void> {
  const runStatusMap: Record<ExecutorResult['status'], ExecutionRun['runStatus']> = {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    needs_manual: 'partial',
  }
  // lint ゲート: checks に NG があれば completed を partial へ格下げ（lint NG を完了扱いにしない）。
  const ngChecks = failingChecks(args.checks)
  const gatedRunStatus = gateRunStatusByChecks(runStatusMap[args.result.status], args.checks)
  const checkWarnings = gatedRunStatus !== runStatusMap[args.result.status]
    ? [`lintゲート: checks NG（${ngChecks.join(' / ')}）のため completed→partial に格下げ。要修正/レビュー待ち。`]
    : []
  const rawReport = `[factory-runner ${args.mode}] executor=${args.executor}\n${args.result.stdout || args.result.resultSummary}`
  const errors = normalizeExecutionRunErrors(args.result.stderr ? [args.result.stderr.slice(0, 500)] : [])
  const nextActions = ensureExecutionRunNextActions({
    nextActions: args.result.nextActions,
    rawReport,
    runStatus: gatedRunStatus,
    stopReason: args.stopReason,
    summary: args.result.resultSummary,
    errors,
  })
  await updateExecutionRunFields(args.runId, {
    finishedAt: new Date().toISOString(),
    runStatus: gatedRunStatus,
    executorUsed: args.executor,
    executorCandidate: args.executor,
    resultReturned: args.mode === 'auto',
    fallbackReason: args.fallbackReason ?? (args.result.rateLimited ? 'claude_rate_limited' : undefined),
    stopReason: gatedRunStatus !== runStatusMap[args.result.status] ? (args.stopReason ?? 'lint_gate_partial') : args.stopReason,
    nextActionCount: nextActions.length,
    summary: args.result.resultSummary,
    changedFiles: args.result.changedFiles.map((f) => ({ file: f, change: '' })),
    checks: args.checks ?? {},
    errors,
    warnings: checkWarnings,
    progressUpdated: false,
    nextActions,
    rawReport,
  })
}

export async function runFactory(opts: RunnerOptions = {}): Promise<FactoryRunReport> {
  const mode: FactoryRunMode = opts.mode ?? 'dry_run'
  let maxRuns = Math.max(1, Math.min(opts.maxRuns ?? 3, 3)) // 初期制限: 1 起動最大 3 Run
  const startedAt = new Date().toISOString()
  const steps: FactoryRunStep[] = []
  let stoppedReason = 'completed'
  let runs = 0
  let perEpic = 0
  let lastRecordedRunId: string | undefined
  let selfHealNeeded = false
  const progressCwd = resolveAppCwd('progress')

  const config = await getAutomationConfig()
  try {
    await recordUrgentIssues()
  } catch (err) {
    console.warn('recordUrgentIssues failed:', err)
  }
  try {
    await ensureBlockedDecisions()
  } catch (err) {
    console.warn('ensureBlockedDecisions failed:', err)
  }
  // 同一 Epic の深掘り回数上限。opts 明示 > config.factoryMaxPerEpic > 既定3 の優先順。
  // 1 にすると1 Run ごとに次 Epic へローテーションし、1サイクルで複数の異なるタスクを回せる。
  const maxPerEpic = Math.max(1, Math.min(opts.maxPerEpic ?? config.factoryMaxPerEpic ?? 3, 3))
  if (!config.factoryEnabled) {
    return finalize('factory_off')
  }

  // 2026-06-11 運用方針変更: レビュー件数では止めない（レビュー100件でも稼働可能）。
  // 停止条件は「人間しか判断できないもの」のみ:
  //   ① 危険判断待ち（本番・課金・認証・公開系の承認が pending）→ 今回の自動実行をスキップ
  //   ② Goal未設定のEpic → そのEpicだけ対象外（全対象EpicがGoal未設定なら実質停止）
  // factoryEnabled は変更しない（恒久OFFにしない）。auto の実起動のみ対象（dry_run / manual は影響なし）。
  const goalUnsetEpicIds = new Set(
    (await getEpics())
      .filter((e) => ['approved', 'active'].includes(e.status) && !e.goalId)
      .map((e) => e.epicId),
  )
  if (mode === 'auto') {
    const approvals = await getPendingApprovals()
    const dangerPending = approvals.filter(
      (a) => DANGER_CATEGORIES.has(a.category) && !isReviewApprovalOptions(a.options.map((o) => o.label)),
    )
    if (dangerPending.length > 0) {
      await appendAutomationLog({
        event: 'factory_backpressure',
        fallbackReason: `危険判断待ち=${dangerPending.length}件: あなたの許可が出るまで今回のFactory自動実行をスキップ（レビュー件数は停止条件から除外済み。factoryEnabledは変更しない）`,
        backpressureAction: 'pause',
      })
      return finalize('blocked_by_danger_decision')
    }
  }

  // 自動実行の最初に、日々の調査結果（news-app の daily research）から「効果がありそうなこと」を
  // ゴール候補として提案する（承認待ちが上限未満のときのみ）。承認されたものが次回以降の自動実行対象になる。
  // ゴールが優先順で消化されて承認待ちが減ると、次回また調査からゴール候補が補充される（＝達成後に次を提案）。
  if (mode === 'auto' && opts.confirm) {
    try {
      const research = await proposeGoalsFromResearchIfNeeded()
      if (research.created.length > 0) {
        await appendAutomationLog({
          event: 'factory_goal_proposal_requested',
          fallbackReason: `${research.reason}: ${research.created.map((g) => g.title).join(' / ')}`,
        })
      }
    } catch (err) {
      console.warn('research goal proposal failed:', err)
    }
  }

  let scan = await scanFactoryDispatch()
  // 実行できる Epic が無いが、todo/epic の無い未達成 Goal がある場合は「次の一歩」Epic を自動生成して進める。
  // （Goal達成が自動実行の目的。auto の実起動かつ confirm 済みのときだけ epic を作る＝read経路・dry_run/manualでは作らない）
  if (!scan.picked && mode === 'auto' && opts.confirm) {
    const step = await ensureNextGoalStepEpic()
    if (step.created) {
      await appendAutomationLog({
        event: 'factory_goal_step_epic_created',
        epicId: step.epicId,
        fallbackReason: `未達成Goal「${step.goalTitle}」にtodo/epicが無いため、次の一歩Epic（${step.epicId}）を自動生成して進めます`,
      })
      scan = await scanFactoryDispatch()
    }
  }
  // それでも自動実行対象が無い（アイドル）場合は「ゴール生成モード」に入り、progress 優先で
  // 改善事項・試した方がいいことをゴール候補(status='proposed')として実際に登録する。
  // これにより承認対象が空のままにならず、承認すれば次回以降の自動実行が空にならない。
  if (!scan.picked && mode === 'auto' && opts.confirm) {
    try {
      const improvement = await proposeImprovementGoalsIfIdle()
      if (improvement.created.length > 0) {
        await appendAutomationLog({
          event: 'factory_goal_proposal_requested',
          fallbackReason: `${improvement.reason}: ${improvement.created.map((g) => g.title).join(' / ')}`,
        })
      }
    } catch (err) {
      console.warn('idle improvement goal proposal failed:', err)
    }
    // 補助: 上で候補を埋め切れなかった場合に備え、AIへの「次に目指すゴール」提案依頼プロンプトもログに残す。
    const proposal = await requestGoalProposalIfIdle()
    await appendAutomationLog({
      event: 'factory_goal_proposal_requested',
      fallbackReason: proposal.requested ? `${proposal.reason}\n${proposal.prompt ?? ''}` : proposal.reason,
    })
  }
  const doneEpics: string[] = []
  // P4: 複数 Epic ループの「処理済み/スキップ済み」を統合管理し、再選択で無限ループしないようにする。
  // Goal未設定（方針選択待ち）のEpicは最初から対象外に入れる。
  const excludedEpics = new Set<string>(goalUnsetEpicIds)

  // 表示キューを順序の正本とし、scan.candidates の安全ゲートを通過した最初の Epic を選ぶ。
  // Goal/todo は auto の実起動かつ confirm 済みの場合だけ「次の一歩」Epic に materialize する。
  async function pickNextEpic(): Promise<string | null> {
    const view = await buildAutoQueue()
    let epics = await getEpics()
    let rescan = await scanFactoryDispatch()

    for (const item of view.executable) {
      let epicId: string | undefined
      if (item.type === 'epic') {
        epicId = item.sourceId
      } else if ((item.type === 'goal' || item.type === 'goal_todo') && item.goalId) {
        const expectedEpicId = `epic-goalstep-${item.goalId}`
        if (mode === 'auto' && opts.confirm) {
          const step = item.type === 'goal_todo'
            ? await ensureNextGoalStepEpic(item.goalId, item.todoId)
            : await ensureNextGoalStepEpic(item.goalId)
          if (step.created) {
            await appendAutomationLog({
              event: 'factory_goal_step_epic_created',
              epicId: step.epicId,
              fallbackReason: `キュー上位のGoal「${step.goalTitle}」を進めるため、次の一歩Epic（${step.epicId}）を自動生成しました`,
            })
          }
          epics = await getEpics()
          rescan = await scanFactoryDispatch()
          epicId = step.created
            ? step.epicId
            : epics.find((epic) => epic.epicId === expectedEpicId)?.epicId
        } else {
          epicId = epics.find((epic) => epic.epicId === expectedEpicId)?.epicId
        }
      }

      if (!epicId || excludedEpics.has(epicId) || goalUnsetEpicIds.has(epicId)) continue
      if (rescan.candidates.some((candidate) => candidate.epicId === epicId)) return epicId
    }
    return null
  }

  if (mode === 'auto' && opts.confirm) {
    await runAiReviewBatchSafely('before_pick')
  }

  const firstRunnableEpicId = await pickNextEpic()
  if (!firstRunnableEpicId) {
    if (scan.picked && goalUnsetEpicIds.size > 0 && scan.candidates.every((p) => goalUnsetEpicIds.has(p.epicId))) {
      await appendAutomationLog({
        event: 'factory_backpressure',
        fallbackReason: `Goal未設定Epic=${goalUnsetEpicIds.size}件のみが候補: Goal紐付け（方針選択）が済むまで停止`,
        backpressureAction: 'pause',
      })
      return finalize('blocked_by_goal_unset')
    }
    return finalize(scan.blocked.length > 0 ? 'all_blocked' : 'no_candidate')
  }
  let currentEpicId = firstRunnableEpicId

  // dry_run / manual は 1 ステップのプレビュー（状態を変えない）。
  if (mode === 'dry_run' || mode === 'manual') {
    const plan = await buildDispatchPlan(currentEpicId)
    if (plan && plan.safetyStatus !== 'blocked') {
      const detail = await getEpicDetail(currentEpicId)
      const targetApp = detail?.epic.targetApps?.[0] ?? 'progress'
      const epicCwd = opts.cwd ?? resolveAppCwd(targetApp)
      if (!epicCwd) {
        await appendAutomationLog({
          event: 'factory_backpressure',
          fallbackReason: `targetApp=${targetApp} の repo パスが未登録のため実行スキップ（誤repo実行防止）`,
          backpressureAction: 'pause',
        })
        steps.push(stop(currentEpicId, plan.epicTitle, plan.executorCandidate, `targetApp=${targetApp} repo未登録`, plan.dispatchPlanId))
        return finalize('target_app_repo_unregistered')
      }
      const executor = plan.executorCandidate === 'codex' ? 'codex' : 'claude'
      const prompt = executor === 'codex'
        ? (await generateCodexPrompt(currentEpicId)).promptText
        : (await generateClaudeFactoryPrompt(currentEpicId))?.promptText ?? plan.goal
      if (mode === 'dry_run') {
        const result = await getAdapter(executor).run({
          epicId: currentEpicId,
          prompt,
          cwd: epicCwd,
          dryRun: true,
          safetyText: `${plan.goal} ${plan.doneCriteria.join(' ')}`,
        })
        steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, stopped: false })
        return finalize('dry_run_single_step')
      }
      const result = await getAdapter('manual').run({ epicId: currentEpicId, prompt, cwd: epicCwd, dryRun: false })
      const recordedRunId = await recordRun({ epicId: currentEpicId, targetApp, title: `Factory(manual): ${plan.epicTitle}`, executor: 'manual', mode, dispatchPlanId: plan.dispatchPlanId, result, selection: selectionFromPlan(plan) })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor: 'manual', result, recordedRunId, stopped: true, stopReason: 'manual_execution_pending' })
      return finalize('manual_execution_pending')
    }
    return finalize('no_candidate')
  }

  // mode === 'auto'（実起動・Epic 内ループ + 完了後に次 Epic へ）
  if (!opts.confirm) return finalize('auto_requires_confirm')

  const executorTimeoutMs = Number(process.env.FACTORY_EXECUTOR_TIMEOUT_MS) || 1_500_000

  while (runs < maxRuns) {
    // P4: 同一 Epic の上限に達したら「全体停止」ではなく「その Epic を打ち切って次 Epic へ」。
    if (perEpic >= maxPerEpic) {
      excludedEpics.add(currentEpicId)
      steps.push(stop(currentEpicId, '—', 'claude', 'max_per_epic_reached → 次Epicへ'))
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }

    const plan = await buildDispatchPlan(currentEpicId)
    if (!plan) {
      // Epic が見つからない → そのEpicを除外して次へ（全体停止しない）。
      excludedEpics.add(currentEpicId)
      steps.push(stop(currentEpicId, '—', 'manual', 'epic_not_found → 次Epicへ'))
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }
    // P4: blocked（riskFlags / approval待ち / manual / decision待ち等）はそのEpicを飛ばして次へ。
    // scan 側ゲートは無改変。ここでは「全体停止」をやめ「skip して次Epic」にするだけ。
    if (plan.safetyStatus === 'blocked') {
      excludedEpics.add(currentEpicId)
      steps.push(stop(currentEpicId, plan.epicTitle, plan.executorCandidate, `blocked: ${plan.blockedReason ?? ''} → 次Epicへ`, plan.dispatchPlanId))
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }

    let executor: ExecutorChoice = plan.executorCandidate === 'codex' ? 'codex' : 'claude'
    const detail = await getEpicDetail(currentEpicId)
    const targetApp = detail?.epic.targetApps?.[0] ?? 'progress'
    const epicCwd = opts.cwd ?? resolveAppCwd(targetApp)
    if (!epicCwd) {
      excludedEpics.add(currentEpicId)
      await appendAutomationLog({
        event: 'factory_backpressure',
        fallbackReason: `targetApp=${targetApp} の repo パスが未登録のため実行スキップ（誤repo実行防止）`,
        backpressureAction: 'pause',
      })
      steps.push(stop(currentEpicId, plan.epicTitle, executor, `targetApp=${targetApp} repo未登録 → 次Epicへ`, plan.dispatchPlanId))
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }
    const followupOfRunId = extractFollowupOfRunId(detail?.epic.notes)
    // 安全判定の意図テキストは Epic 固有（goal + doneCriteria）のみ。
    // dispatch.nextActions は他 Epic 由来の候補が混じり禁止語を誤検知するため使わない。
    const intent = `${plan.goal} ${(detail?.epic.doneCriteria ?? []).join(' ')}`
    const executorPrompt = executor === 'codex'
      ? (await generateCodexPrompt(currentEpicId)).promptText
      : (await generateClaudeFactoryPrompt(currentEpicId))?.promptText ?? plan.goal

    const runIndex = runs + 1
    const runningRunId = await startRunningRun({
      epicId: currentEpicId,
      targetApp,
      title: `Factory(auto): ${plan.epicTitle}`,
      executor,
      mode,
      dispatchPlanId: plan.dispatchPlanId,
      runIndex,
      followupOfRunId,
      selection: selectionFromPlan(plan),
    })

    // Dispatch判定で選ばれたexecutorを起動する。
    let result: ExecutorResult
    const shouldSimulateRateLimit =
      executor === 'claude' &&
      (opts.simulateRateLimit ||
        (typeof opts.simulateRateLimitFromRun === 'number' && runIndex >= opts.simulateRateLimitFromRun))
    if (shouldSimulateRateLimit) {
      result = { status: 'failed', stdout: '[sim] claude rate_limit', stderr: '', resultSummary: '[sim] Claude 上限を擬似発生', changedFiles: [], errorType: 'claude_rate_limited', rateLimited: true, needsApproval: false, nextActions: [] }
    } else if (executor === 'claude' && opts.simulateClaudeSuccessBeforeRateLimit) {
      result = { status: 'completed', stdout: '[sim] Claude completed before rate_limit', stderr: '', resultSummary: '[sim] Claude 上限前のRunを成功扱い', changedFiles: [], rateLimited: false, needsApproval: false, nextActions: [] }
    } else {
      result = await getAdapter(executor).run({
        epicId: currentEpicId,
        prompt: executorPrompt,
        cwd: epicCwd,
        dryRun: false,
        safetyText: intent,
        timeoutMs: executorTimeoutMs,
      })
    }

    // Claude 上限 → AutoFallback → Codex（ON かつ安全なら）
    if (executor === 'claude' && result.rateLimited) {
      const fallback = decideCodexFallback({
        attemptedExecutor: executor,
        result,
        autoFallback: config.autoFallback,
        executorMode: config.executorMode,
        canRunOnCodex: plan.canRunOnCodex,
        requiresClaude: plan.requiresClaude,
      })
      await appendAutomationLog({
        event: 'auto_fallback',
        fallbackTriggered: fallback.shouldFallback,
        fallbackReason: fallback.reason,
        fallbackTarget: 'codex',
        codexPromptGenerated: false,
        safetyGuard: true,
        blockedReason: fallback.shouldFallback ? undefined : fallback.reason,
        epicId: currentEpicId,
      })
      if (fallback.shouldFallback) {
        const codexPrompt = (await generateCodexPrompt(currentEpicId)).promptText
        result = opts.simulateCodexSuccessAfterFallback
          ? { status: 'completed', stdout: '[sim] Codex continued after Claude rate_limit', stderr: '', resultSummary: '[sim] Codex fallback Runを成功扱い', changedFiles: [], rateLimited: false, needsApproval: false, nextActions: [] }
          : await getAdapter('codex').run({ epicId: currentEpicId, prompt: codexPrompt, cwd: epicCwd, dryRun: false, safetyText: intent, timeoutMs: executorTimeoutMs })
        executor = 'codex'
      } else {
        await finishRunningRun({ runId: runningRunId, executor: 'claude', mode, result, stopReason: 'claude_rate_limited / Codex不可' })
        if (progressCwd && epicCwd === progressCwd) selfHealNeeded = true
        const recordedRunId = runningRunId
        steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor: 'claude', result, recordedRunId, stopped: true, stopReason: 'claude_rate_limited / Codex不可' })
        await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
        await detectGoalstepStaleNoChange({ epicId: currentEpicId, epicTitle: plan.epicTitle, recordedRunId })
        stoppedReason = 'rate_limited_no_codex'
        break
      }
    }

    // Level1（機械判定）: typecheck / lint を実行して checks へ構造化保存する。
    const checks = await runChecks(epicCwd, { typecheck: true, lint: true })
    await finishRunningRun({ runId: runningRunId, executor, mode, result, checks })
    const recordedRunId = runningRunId
    lastRecordedRunId = recordedRunId
    if (progressCwd && epicCwd === progressCwd) selfHealNeeded = true
    runs++; perEpic++

    if (result.needsApproval) {
      // 承認が必要な作業は Approval Queue に積む（安全ゲートは無改変）。
      // P4: その Epic はこの起動では飛ばし（excluded）、次 Epic へ進む。承認自体は人が後で判断する。
      await createApproval({ epicId: currentEpicId, title: `Factory: ${plan.epicTitle} の判断`, category: 'executor_fallback', reason: result.resultSummary, options: [{ key: 'approve', label: '承認' }, { key: 'reject', label: '却下' }], recommended: 'approve' })
      await updateExecutionRunFields(recordedRunId, { stopReason: 'approval_required' })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: true, stopReason: 'approval_required → 次Epicへ' })
      await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
      await detectGoalstepStaleNoChange({ epicId: currentEpicId, epicTitle: plan.epicTitle, recordedRunId })
      excludedEpics.add(currentEpicId)
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }
    if (result.status === 'failed') {
      await updateExecutionRunFields(recordedRunId, { stopReason: 'run_failed' })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: true, stopReason: 'run_failed' })
      await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
      await detectGoalstepStaleNoChange({ epicId: currentEpicId, epicTitle: plan.epicTitle, recordedRunId })
      stoppedReason = 'run_failed'
      break
    }

    // lint ゲート: 直近 Run の checks に NG があるなら Epic を done にしない（lint NG を完了扱いにしない）。
    // doneCriteria が lint を明示していなくても、機械判定 NG の状態で Epic 完了させず継続/要修正に回す。
    const runNgChecks = failingChecks(checks)
    if (runNgChecks.length > 0) {
      await updateExecutionRunFields(recordedRunId, {
        doneCriteriaStatus: 'continue',
        stopReason: `lint_gate_blocked（checks NG: ${runNgChecks.join(' / ')}）`,
      })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: false, stopReason: `lint_gate_blocked（checks NG: ${runNgChecks.join(' / ')}） → 要修正で継続` })
      await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
      const staleNoChange = await detectGoalstepStaleNoChange({ epicId: currentEpicId, epicTitle: plan.epicTitle, recordedRunId })
      if (staleNoChange) {
        excludedEpics.add(currentEpicId)
        const next = await pickNextEpic()
        if (!next) { stoppedReason = 'all_epics_done'; break }
        currentEpicId = next
        perEpic = 0
      }
      continue
    }

    // doneCriteria 自動判定: done → Epic 完了して次 Epic へ。continue → 同一 Epic で次 Run。
    const evalResult = await getDoneCriteriaForEpic(currentEpicId)
    if (evalResult && evalResult.verdict === 'done') {
      await updateEpic(currentEpicId, { status: 'done', progress: 100 })
      await propagateEpicDoneToGoal(currentEpicId, detail?.epic.goalId)
      doneEpics.push(currentEpicId)
      excludedEpics.add(currentEpicId)
      await updateExecutionRunFields(recordedRunId, { doneCriteriaStatus: 'done', stopReason: `epic_done（doneCriteria ${evalResult.ratio}）` })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: true, stopReason: `epic_done（doneCriteria ${evalResult.ratio}） → 次Epicへ` })
      await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
      // P4: 次の eligible Epic へ進む（priority 順 / done・skip 済みは除外）。
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }
    await updateExecutionRunFields(recordedRunId, { doneCriteriaStatus: evalResult?.verdict, stopReason: evalResult ? `continue（doneCriteria ${evalResult.ratio}）` : 'continue' })
    steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: false, stopReason: evalResult ? `continue（doneCriteria ${evalResult.ratio}）` : 'continue' })
    await runAiReviewBatchSafely(`after_run:${recordedRunId}`)
    const staleNoChange = await detectGoalstepStaleNoChange({ epicId: currentEpicId, epicTitle: plan.epicTitle, recordedRunId })
    if (staleNoChange) {
      excludedEpics.add(currentEpicId)
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
    }
  }

  if (runs >= maxRuns && stoppedReason === 'completed') {
    stoppedReason = 'max_runs_reached'
    if (lastRecordedRunId) {
      await updateExecutionRunFields(lastRecordedRunId, { stopReason: 'max_runs_reached' })
    }
  }

  return finalize(stoppedReason)

  function stop(epicId: string, epicTitle: string, executor: ExecutorChoice, reason: string, dispatchPlanId = '—'): FactoryRunStep {
    return { epicId, epicTitle, dispatchPlanId, executor, stopped: true, stopReason: reason }
  }

  function finalize(reason: string): FactoryRunReport {
    if (selfHealNeeded && progressCwd && mode === 'auto' && opts.confirm) {
      triggerProgressSelfHealIfNeeded({ cwd: progressCwd, mode, confirm: opts.confirm })
    }
    // 遷移順（重複排除）。steps は着手・スキップ・完了を時系列で持つため順序がそのまま遷移順。
    const epicsVisited = Array.from(new Set(steps.map((s) => s.epicId)))
    return {
      mode,
      factoryEnabled: config.factoryEnabled,
      startedAt,
      finishedAt: new Date().toISOString(),
      maxRuns,
      maxPerEpic,
      runsExecuted: runs,
      steps,
      stoppedReason: reason,
      doneEpics: [...doneEpics],
      epicsVisited,
    }
  }
}
