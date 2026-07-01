import type { ExecutorChoice } from './types/operations'
import type { ExecutorResult } from './executors/types'

type ExecutorMode = 'claude' | 'codex' | 'both'

export interface CodexFallbackPolicyInput {
  attemptedExecutor: ExecutorChoice
  result: Pick<ExecutorResult, 'rateLimited'>
  autoFallback: boolean
  executorMode: ExecutorMode
  canRunOnCodex: boolean
  requiresClaude?: boolean
}

export interface CodexFallbackPolicyResult {
  shouldFallback: boolean
  reason: string
}

export function decideCodexFallback(input: CodexFallbackPolicyInput): CodexFallbackPolicyResult {
  if (input.attemptedExecutor !== 'claude') {
    return { shouldFallback: false, reason: 'attempted_executor_is_not_claude' }
  }
  if (!input.result.rateLimited) {
    return { shouldFallback: false, reason: 'result_is_not_rate_limited' }
  }
  if (!input.autoFallback) {
    return { shouldFallback: false, reason: 'auto_fallback_disabled' }
  }
  if (input.executorMode !== 'both' && input.executorMode !== 'codex') {
    return { shouldFallback: false, reason: `executor_mode_${input.executorMode}` }
  }
  if (input.requiresClaude) {
    return { shouldFallback: false, reason: 'requires_claude' }
  }
  if (!input.canRunOnCodex) {
    return { shouldFallback: false, reason: 'codex_not_allowed_for_work' }
  }
  return { shouldFallback: true, reason: 'claude_rate_limited' }
}
