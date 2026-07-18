import type { ExecutionRun } from '@/types/execution-run'

const ACTIONABLE_ERROR_PATTERN =
  /\b(error|failed|failure|exception|traceback|typeerror|referenceerror|syntaxerror|stderr|exit\s+code|command\s+failed|timed?\s*out|timeout|enoent|eacces|cannot|unable|not\s+found)\b|エラー|失敗|例外|タイムアウト|HTTP\/[0-9.]+\s+[45][0-9]{2}/i

const SUCCESS_OR_INSPECTION_NOISE_PATTERNS = [
  /\bsucceeded in \d+ms\b/i,
  /\bHTTP\/[0-9.]+\s+(?:200|201|202|204|301|302|304)\b/i,
  /<script\b|<\/body>|<\/html>/i,
  /^\s*(?:M|A|D|R|C|U|\?\?)\s+\S+/,
  /^On branch /i,
  /^Changes (?:not staged|to be committed|not tracked)/i,
  /^Untracked files:/i,
  /^nothing to commit/i,
  /^diff --git /,
  /^index [0-9a-f]+\.\.[0-9a-f]+/,
  /^---\s+(?:a\/|\/dev\/null)/,
  /^\+\+\+\s+(?:b\/|\/dev\/null)/,
  /^@@\s/,
]

function isInspectionNoise(message: string): boolean {
  const lines = message.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return true
  return lines.every((line) => SUCCESS_OR_INSPECTION_NOISE_PATTERNS.some((pattern) => pattern.test(line)))
}

function isActionableError(message: string): boolean {
  const text = message.trim()
  if (!text) return false
  if (isInspectionNoise(text)) return false
  return ACTIONABLE_ERROR_PATTERN.test(text)
}

export function normalizeExecutionRunErrors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    const message = typeof item === 'string' ? item.trim() : ''
    if (!message) continue
    if (!isActionableError(message)) continue
    out.push(message)
  }
  return out
}

export function actionableExecutionRunErrors(run: Pick<ExecutionRun, 'errors'>): string[] {
  return normalizeExecutionRunErrors(run.errors)
}
