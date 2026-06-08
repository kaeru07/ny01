import {
  getAutomationConfig,
  getEpicDetail,
  generateCodexPrompt,
  createApproval,
  appendAutomationLog,
  updateEpic,
} from './operations-store'
import { scanFactoryDispatch, buildDispatchPlan, generateClaudeFactoryPrompt } from './factory-dispatch'
import { addExecutionRun, updateExecutionRunFields } from './execution-run-writer'
import { getAdapter } from './executors'
import { runChecks } from './checks-runner'
import type { ChecksRunResult } from './checks-runner'
import { getDoneCriteriaForEpic } from './done-criteria'
import type { FactoryRunMode, FactoryRunReport, FactoryRunStep, ExecutorResult } from './executors/types'
import type { ExecutionRun } from '@/types/execution-run'
import type { ExecutorChoice } from './types/operations'

// factory-runner: scan→pick→Dispatch→（adapter で）Run→ExecutionRun 記録→次へ。
// 安全第一: 既定は dry_run（実起動なし）。caps（maxRuns / maxPerEpic）で無限ループを防ぐ。
// auto は明示時のみ。Claude 基本→上限時に Codex fallback（AutoFallback ON かつ安全なら）。
// 禁止: 無限ループ / 危険作業の Codex 委譲 / Approval・Decision 待ちの実行 / チャットで質問停止。

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
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
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
  /** fallback で Codex に切替えた Run には claude_rate_limited を残す。 */
  fallbackReason?: string
  /** この Run で即停止した場合の理由。 */
  stopReason?: string
}): Promise<string> {
  const runId = generateRunId()
  const now = new Date().toISOString()
  const runStatusMap: Record<ExecutorResult['status'], ExecutionRun['runStatus']> = {
    completed: 'completed',
    partial: 'partial',
    failed: 'failed',
    needs_manual: 'running',
  }
  const run: ExecutionRun = {
    runId,
    startedAt: now,
    finishedAt: now,
    targetApp: args.targetApp,
    epicId: args.epicId,
    targetTodoTitle: args.title,
    runStatus: runStatusMap[args.result.status],
    reviewStatus: 'not_reviewed',
    source: 'factory_runner',
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
    nextActionCount: args.result.nextActions.length,
    summary: args.result.resultSummary,
    changedFiles: args.result.changedFiles.map((f) => ({ file: f, change: '' })),
    checks: args.checks ?? {},
    errors: args.result.stderr ? [args.result.stderr.slice(0, 500)] : [],
    warnings: [],
    progressUpdated: false,
    nextActions: args.result.nextActions,
    rawReport: `[factory-runner ${args.mode}] executor=${args.executor}\n${args.result.stdout || args.result.resultSummary}`,
  }
  await addExecutionRun(run)
  return runId
}

export async function runFactory(opts: RunnerOptions = {}): Promise<FactoryRunReport> {
  const mode: FactoryRunMode = opts.mode ?? 'dry_run'
  const maxRuns = Math.max(1, Math.min(opts.maxRuns ?? 3, 3)) // 初期制限: 1 起動最大 3 Run
  const maxPerEpic = Math.max(1, Math.min(opts.maxPerEpic ?? 3, 3))
  const startedAt = new Date().toISOString()
  const steps: FactoryRunStep[] = []
  let stoppedReason = 'completed'
  let runs = 0
  let perEpic = 0
  let lastRecordedRunId: string | undefined

  const config = await getAutomationConfig()
  if (!config.factoryEnabled) {
    return finalize('factory_off')
  }

  const scan = await scanFactoryDispatch()
  if (!scan.picked) {
    return finalize(scan.blocked.length > 0 ? 'all_blocked' : 'no_candidate')
  }

  const cwd = opts.cwd ?? process.cwd()
  let currentEpicId = scan.picked.epicId
  const doneEpics: string[] = []
  // P4: 複数 Epic ループの「処理済み/スキップ済み」を統合管理し、再選択で無限ループしないようにする。
  const excludedEpics = new Set<string>()

  // 次に進める eligible Epic を選ぶ（priority 順 / excluded は除外）。無ければ null。
  // scan.candidates は safetyStatus=ok のみ（blocked / approval / riskFlags / manual / factoryEligible=false
  // は evaluateFactoryEligibility → buildDispatchPlan で既に除外済み）。
  async function pickNextEpic(): Promise<string | null> {
    const rescan = await scanFactoryDispatch()
    const next = rescan.candidates.find((p) => !excludedEpics.has(p.epicId))
    return next?.epicId ?? null
  }

  // dry_run / manual は 1 ステップのプレビュー（状態を変えない）。
  if (mode === 'dry_run' || mode === 'manual') {
    const plan = await buildDispatchPlan(currentEpicId)
    if (plan && plan.safetyStatus !== 'blocked') {
      const prompt = (await generateClaudeFactoryPrompt(currentEpicId))?.promptText ?? plan.goal
      if (mode === 'dry_run') {
        const result = await getAdapter('claude').run({ epicId: currentEpicId, prompt, dryRun: true })
        steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor: 'claude', result, stopped: false })
        return finalize('dry_run_single_step')
      }
      const detail = await getEpicDetail(currentEpicId)
      const result = await getAdapter('manual').run({ epicId: currentEpicId, prompt, dryRun: false })
      const recordedRunId = await recordRun({ epicId: currentEpicId, targetApp: detail?.epic.targetApps?.[0] ?? 'progress', title: `Factory(manual): ${plan.epicTitle}`, executor: 'manual', mode, dispatchPlanId: plan.dispatchPlanId, result })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor: 'manual', result, recordedRunId, stopped: true, stopReason: 'manual_execution_pending' })
      return finalize('manual_execution_pending')
    }
    return finalize('no_candidate')
  }

  // mode === 'auto'（実起動・Epic 内ループ + 完了後に次 Epic へ）
  if (!opts.confirm) return finalize('auto_requires_confirm')

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

    let executor: ExecutorChoice = 'claude'
    const detail = await getEpicDetail(currentEpicId)
    const targetApp = detail?.epic.targetApps?.[0] ?? 'progress'
    // 安全判定の意図テキストは Epic 固有（goal + doneCriteria）のみ。
    // dispatch.nextActions は他 Epic 由来の候補が混じり禁止語を誤検知するため使わない。
    const intent = `${plan.goal} ${(detail?.epic.doneCriteria ?? []).join(' ')}`
    const claudePrompt = (await generateClaudeFactoryPrompt(currentEpicId))?.promptText ?? plan.goal

    const runIndex = runs + 1

    // 基本 Claude（simulateRateLimit のときは擬似的に上限化）。
    let result: ExecutorResult
    const shouldSimulateRateLimit =
      opts.simulateRateLimit ||
      (typeof opts.simulateRateLimitFromRun === 'number' && runIndex >= opts.simulateRateLimitFromRun)
    if (shouldSimulateRateLimit) {
      result = { status: 'failed', stdout: '[sim] claude rate_limit', stderr: '', resultSummary: '[sim] Claude 上限を擬似発生', changedFiles: [], errorType: 'claude_rate_limited', rateLimited: true, needsApproval: false, nextActions: [] }
    } else if (opts.simulateClaudeSuccessBeforeRateLimit) {
      result = { status: 'completed', stdout: '[sim] Claude completed before rate_limit', stderr: '', resultSummary: '[sim] Claude 上限前のRunを成功扱い', changedFiles: [], rateLimited: false, needsApproval: false, nextActions: [] }
    } else {
      result = await getAdapter('claude').run({ epicId: currentEpicId, prompt: claudePrompt, cwd, dryRun: false })
    }

    // Claude 上限 → AutoFallback → Codex（ON かつ安全なら）
    if (result.rateLimited) {
      await appendAutomationLog({ event: 'auto_fallback', fallbackTriggered: true, fallbackReason: 'claude_rate_limited', fallbackTarget: 'codex', codexPromptGenerated: false, safetyGuard: true, epicId: currentEpicId })
      if (config.autoFallback && plan.canRunOnCodex) {
        const codexPrompt = (await generateCodexPrompt(currentEpicId)).promptText
        result = opts.simulateCodexSuccessAfterFallback
          ? { status: 'completed', stdout: '[sim] Codex continued after Claude rate_limit', stderr: '', resultSummary: '[sim] Codex fallback Runを成功扱い', changedFiles: [], rateLimited: false, needsApproval: false, nextActions: [] }
          : await getAdapter('codex').run({ epicId: currentEpicId, prompt: codexPrompt, cwd, dryRun: false, safetyText: intent })
        executor = 'codex'
      } else {
        const recordedRunId = await recordRun({ epicId: currentEpicId, targetApp, title: `Factory(auto): ${plan.epicTitle}`, executor: 'claude', mode, dispatchPlanId: plan.dispatchPlanId, result, runIndex, stopReason: 'claude_rate_limited / Codex不可' })
        steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor: 'claude', result, recordedRunId, stopped: true, stopReason: 'claude_rate_limited / Codex不可' })
        stoppedReason = 'rate_limited_no_codex'
        break
      }
    }

    // Level1（機械判定）: typecheck / lint を実行して checks へ構造化保存する。
    const checks = await runChecks(cwd, { typecheck: true, lint: true })
    const recordedRunId = await recordRun({ epicId: currentEpicId, targetApp, title: `Factory(auto): ${plan.epicTitle}`, executor, mode, dispatchPlanId: plan.dispatchPlanId, result, checks, runIndex })
    lastRecordedRunId = recordedRunId
    runs++; perEpic++

    if (result.needsApproval) {
      // 承認が必要な作業は Approval Queue に積む（安全ゲートは無改変）。
      // P4: その Epic はこの起動では飛ばし（excluded）、次 Epic へ進む。承認自体は人が後で判断する。
      await createApproval({ epicId: currentEpicId, title: `Factory: ${plan.epicTitle} の判断`, category: 'executor_fallback', reason: result.resultSummary, options: [{ key: 'approve', label: '承認' }, { key: 'reject', label: '却下' }], recommended: 'approve' })
      await updateExecutionRunFields(recordedRunId, { stopReason: 'approval_required' })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: true, stopReason: 'approval_required → 次Epicへ' })
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
      stoppedReason = 'run_failed'
      break
    }

    // doneCriteria 自動判定: done → Epic 完了して次 Epic へ。continue → 同一 Epic で次 Run。
    const evalResult = await getDoneCriteriaForEpic(currentEpicId)
    if (evalResult && evalResult.verdict === 'done') {
      await updateEpic(currentEpicId, { status: 'done', progress: 100 })
      doneEpics.push(currentEpicId)
      excludedEpics.add(currentEpicId)
      await updateExecutionRunFields(recordedRunId, { doneCriteriaStatus: 'done', stopReason: `epic_done（doneCriteria ${evalResult.ratio}）` })
      steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: true, stopReason: `epic_done（doneCriteria ${evalResult.ratio}） → 次Epicへ` })
      // P4: 次の eligible Epic へ進む（priority 順 / done・skip 済みは除外）。
      const next = await pickNextEpic()
      if (!next) { stoppedReason = 'all_epics_done'; break }
      currentEpicId = next
      perEpic = 0
      continue
    }
    await updateExecutionRunFields(recordedRunId, { doneCriteriaStatus: evalResult?.verdict, stopReason: evalResult ? `continue（doneCriteria ${evalResult.ratio}）` : 'continue' })
    steps.push({ epicId: currentEpicId, epicTitle: plan.epicTitle, dispatchPlanId: plan.dispatchPlanId, executor, result, recordedRunId, stopped: false, stopReason: evalResult ? `continue（doneCriteria ${evalResult.ratio}）` : 'continue' })
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
