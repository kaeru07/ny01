import { getAppFactoryCandidates, type AppFactoryCandidate, type AppFactoryMockScreen } from './app-factory-candidates'
import { readJson } from './store'
import type { GoalsData } from '@/types/goal'

const GOAL_APP_PREFIX = 'goal-app-'
const MAX_CONTEXT_LENGTH = 2000

export interface AppIntentContextInput {
  purpose?: string
  mvpScope?: string
  spec?: string
  screens?: AppFactoryMockScreen[]
  initialGoalDraft?: string
  notes?: string
}

function slug(input: string): string {
  const ascii = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  if (ascii) return ascii
  return Buffer.from(input).toString('hex').slice(0, 32)
}

function trimText(value: string | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function truncateContext(text: string): string {
  return text.length > MAX_CONTEXT_LENGTH ? text.slice(0, MAX_CONTEXT_LENGTH) : text
}

export function formatAppIntentContext(input: AppIntentContextInput): string {
  const lines = ['## アプリ仕様（ユーザー承認済み。この仕様に沿って作ること）']
  const purpose = trimText(input.purpose)
  const mvpScope = trimText(input.mvpScope)
  const spec = trimText(input.spec)
  const initialGoalDraft = trimText(input.initialGoalDraft)
  const notes = trimText(input.notes)

  if (purpose) lines.push(`目的: ${purpose}`)
  if (mvpScope) lines.push(`MVP範囲: ${mvpScope}`)
  if (spec) lines.push(`仕様: ${spec}`)

  const screenLines = (input.screens ?? [])
    .map((screen) => {
      const name = trimText(screen.name)
      const rows = (screen.rows ?? []).map((row) => trimText(row)).filter(Boolean).slice(0, 3)
      if (!name && rows.length === 0) return ''
      return `${name || '画面'}: ${rows.join(' / ')}`
    })
    .filter(Boolean)
  if (screenLines.length > 0) {
    lines.push('画面:')
    lines.push(...screenLines)
  }

  if (initialGoalDraft) lines.push(`初期実装計画: ${initialGoalDraft}`)
  if (notes) lines.push(`ユーザーの意図メモ: ${notes}`)

  return lines.length > 1 ? truncateContext(lines.join('\n')) : ''
}

function candidateProjectId(candidate: AppFactoryCandidate): string {
  return candidate.sourceProjectId ?? slug(candidate.id || candidate.title)
}

function findCandidate(candidates: AppFactoryCandidate[], projectId: string): AppFactoryCandidate | undefined {
  return candidates.find((candidate) => candidate.sourceProjectId === projectId)
    ?? candidates.find((candidate) => candidateProjectId(candidate) === projectId)
}

export async function buildAppIntentContext(goalId?: string): Promise<string> {
  if (!goalId?.startsWith(GOAL_APP_PREFIX)) return ''

  try {
    const projectId = goalId.slice(GOAL_APP_PREFIX.length)
    if (!projectId) return ''

    const [queue, goalsData] = await Promise.all([
      getAppFactoryCandidates(),
      readJson<GoalsData>('goals.json', { goals: [], updatedAt: '' }),
    ])
    const candidate = findCandidate(queue.candidates ?? [], projectId)
    if (!candidate) return ''

    const goal = goalsData.goals.find((item) => item.id === goalId)
    return formatAppIntentContext({
      purpose: candidate.purpose,
      mvpScope: candidate.mvpScope,
      spec: candidate.spec,
      screens: candidate.screens,
      initialGoalDraft: candidate.initialGoalDraft,
      notes: goal?.notes,
    })
  } catch {
    return ''
  }
}
