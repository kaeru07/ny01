import type { ExecutionRun } from '@/types/execution-run'

const LIMIT_PATTERN = /(claude[\s_-]?rate[\s_-]?limited|rate[\s_/-]?limit|usage[\s_-]?limit|利用上限|使用量の上限|上限に達)/i

export interface ClaudeRecoveryDetection {
  status: 'recovered' | 'limited' | 'unknown'
  recovered: boolean
  limitRunId?: string
  recoveryRunId?: string
  reason: string
}

function runTime(run: ExecutionRun): number {
  return Date.parse(run.finishedAt || run.startedAt || '')
}

function isExplicitLimit(run: ExecutionRun): boolean {
  const structuredText = `${run.fallbackReason ?? ''} ${(run.errors ?? []).join(' ')}`
  return LIMIT_PATTERN.test(structuredText)
}

/**
 * ExecutionRun の構造化フィールドだけを使い、Claude 上限後の回復を受動検知する。
 * 上限後に Claude 自身の completed Run がある場合だけ recovered とする。
 * Codex/manual の成功や上限前の Claude 成功は回復根拠にしない。
 */
export function detectClaudeRecoveryFromRuns(runs: ExecutionRun[]): ClaudeRecoveryDetection {
  const ordered = runs
    .filter((run) => !Number.isNaN(runTime(run)))
    .sort((a, b) => runTime(a) - runTime(b))

  const latestLimit = [...ordered].reverse().find(isExplicitLimit)
  if (!latestLimit) {
    return { status: 'unknown', recovered: false, reason: 'Claude上限の記録なし' }
  }

  const limitAt = runTime(latestLimit)
  const recovery = ordered.find(
    (run) =>
      runTime(run) > limitAt &&
      run.executorUsed === 'claude' &&
      run.runStatus === 'completed' &&
      !isExplicitLimit(run),
  )

  if (!recovery) {
    return {
      status: 'limited',
      recovered: false,
      limitRunId: latestLimit.runId,
      reason: '上限記録後のClaude成功Runなし',
    }
  }

  return {
    status: 'recovered',
    recovered: true,
    limitRunId: latestLimit.runId,
    recoveryRunId: recovery.runId,
    reason: '上限記録後にClaude成功Runを確認',
  }
}
