import type { ExecutionRun } from '@/types/execution-run'

const NEXT_ACTION_HEADINGS = [
  '次アクション',
  '次にやること',
  '次のアクション',
  'nextActions',
  'Next Actions',
  'Next actions',
]

function cleanAction(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const cleaned = value
    .trim()
    .replace(/^[\s\-*・\d.]+/, '')
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .trim()
  return cleaned ? cleaned.slice(0, 240) : null
}

function unique(actions: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const action of actions) {
    const cleaned = cleanAction(action)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    out.push(cleaned)
  }
  return out
}

function extractFromReport(rawReport?: string): string[] {
  if (!rawReport) return []
  const lines = rawReport.split(/\r?\n/)
  const actions: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    const heading = NEXT_ACTION_HEADINGS.find((h) => line.toLowerCase().includes(h.toLowerCase()))
    if (!heading) continue

    const inline = line.split(/[:：]/).slice(1).join(':')
    const inlineAction = cleanAction(inline)
    if (inlineAction) actions.push(inlineAction)

    for (let j = i + 1; j < Math.min(lines.length, i + 6); j += 1) {
      const nextLine = lines[j].trim()
      if (!nextLine) {
        if (actions.length > 0) break
        continue
      }
      if (/^#{1,6}\s+/.test(nextLine) || /^[\[【].+[\]】]$/.test(nextLine)) break
      const bullet = cleanAction(nextLine)
      if (bullet) actions.push(bullet)
    }
  }

  return unique(actions).slice(0, 3)
}

function fallbackAction(input: {
  runStatus?: ExecutionRun['runStatus']
  stopReason?: string
  summary?: string
  targetTodoTitle?: string
  errors?: string[]
  warnings?: string[]
}): string {
  const stopReason = input.stopReason?.trim()
  const firstIssue = input.errors?.find(Boolean) ?? input.warnings?.find(Boolean)
  if (input.runStatus === 'failed') {
    return cleanAction(firstIssue)
      ?? (stopReason ? `失敗理由「${stopReason}」を確認して再実行条件を整理する` : '失敗理由を確認して、再実行条件を整理する')
  }
  if (input.runStatus === 'running') {
    return '実行結果を回収してExecutionRunを完了状態に更新する'
  }
  if (stopReason && !/epic_done/.test(stopReason)) {
    return `停止理由「${stopReason}」を確認し、次の実行候補を決める`
  }
  const title = input.targetTodoTitle?.trim() || input.summary?.trim()
  return title ? `${title} の結果を確認し、未達のDoneCriteriaを1つ進める` : '未達のDoneCriteriaを1つ選び、次の実行で検証可能な作業に分解する'
}

export function ensureExecutionRunNextActions(input: {
  nextActions?: unknown
  rawReport?: string
  runStatus?: ExecutionRun['runStatus']
  stopReason?: string
  summary?: string
  targetTodoTitle?: string
  errors?: string[]
  warnings?: string[]
}): string[] {
  const explicit = Array.isArray(input.nextActions) ? unique(input.nextActions).slice(0, 5) : []
  if (explicit.length > 0) return explicit

  const extracted = extractFromReport(input.rawReport)
  if (extracted.length > 0) return extracted

  return [fallbackAction(input)]
}
