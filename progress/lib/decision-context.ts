import { readJson } from './store'
import { readExecutionRuns } from './execution-run-reader'
import type { Approval } from './types/operations'

interface DecisionEpicScope {
  epicId: string
  goalId?: string
  targetApp?: string
}

function labelForDecision(options: { key: string; label: string }[], decidedOption?: string): string {
  if (!decidedOption) return ''
  return options.find((option) => option.key === decidedOption)?.label ?? decidedOption
}

export async function buildDecisionContext(epic: DecisionEpicScope, goalProjectId?: string): Promise<string> {
  try {
    const [approvals, runs] = await Promise.all([readJson<Approval[]>('approvals.json', []), readExecutionRuns()])
    const runIds = new Set(runs.filter((run) => run.epicId === epic.epicId).map((run) => run.runId))
    const projectKeys = new Set([goalProjectId, epic.targetApp].filter((value): value is string => Boolean(value)))

    const matched = approvals
      .filter((approval) => approval.status === 'decided')
      // システム自動クローズ(auto_closed)は人間の判断ではないため注入しない。
      .filter((approval) => approval.decidedOption !== 'auto_closed')
      .filter((approval) => (
        approval.epicId === epic.epicId ||
        (!!approval.projectId && projectKeys.has(approval.projectId)) ||
        (!!approval.createdRunId && runIds.has(approval.createdRunId))
      ))
      .sort((a, b) => Date.parse(b.decidedAt ?? '') - Date.parse(a.decidedAt ?? ''))
      .slice(0, 20)

    if (matched.length === 0) return ''

    const lines = matched.map((approval) => {
      const label = labelForDecision(approval.options, approval.decidedOption)
      return `- ${approval.title} → ${label}`
    })
    return [
      '## ユーザー決定事項（今日の判断での回答。必ず従うこと）',
      ...lines,
    ].join('\n')
  } catch {
    return ''
  }
}
