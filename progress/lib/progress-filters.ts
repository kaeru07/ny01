export type ProgressFilterExecutor = 'unset' | 'set'

export interface ProgressFilterState {
  view?: string
  tab?: string
  goalId?: string
  projectId?: string
  app?: string
  status?: string
  reviewStatus?: string
  priority?: string
  pinned?: boolean
  excluded?: boolean
  manualOnly?: boolean
  executor?: ProgressFilterExecutor
  runnable?: boolean
  blocked?: boolean
  aiHold?: boolean
  hasNextAction?: boolean
  fixPrompt?: boolean
  q?: string
  focusRunId?: string
}

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined> | undefined

const QUEUE_STATUS_FILTERS = new Set(['executable', 'waiting_user', 'ai_hold', 'review_waiting', 'blocked', 'manual', 'done'])
const REVIEW_STATUS_FILTERS = new Set(['unconfirmed', 'followup', 'needs_followup', 'snoozed', 'reviewed'])

function firstValue(input: SearchInput, key: string): string | undefined {
  if (!input) return undefined
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined
  const value = input[key]
  return Array.isArray(value) ? value[0] : value
}

function boolValue(value: string | undefined): boolean | undefined {
  if (value == null || value === '') return undefined
  if (['1', 'true', 'yes', 'on'].includes(value)) return true
  if (['0', 'false', 'no', 'off'].includes(value)) return false
  return undefined
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeTab(value: string | undefined): string | undefined {
  if (value === 'today') return 'decisions'
  if (value === 'review') return 'reviews'
  return clean(value)
}

function serializeTab(value: string | undefined): string | undefined {
  if (value === 'decisions') return 'today'
  if (value === 'reviews') return 'review'
  return value
}

function normalizeReviewStatus(value: string | undefined): string | undefined {
  if (value === 'followup') return 'needs_followup'
  return clean(value)
}

export function parseProgressFilters(searchParams?: SearchInput): ProgressFilterState {
  const legacyFilter = clean(firstValue(searchParams, 'filter'))
  const status = legacyFilter && QUEUE_STATUS_FILTERS.has(legacyFilter) ? legacyFilter : clean(firstValue(searchParams, 'status'))
  const legacyReviewStatus = legacyFilter && REVIEW_STATUS_FILTERS.has(legacyFilter) ? legacyFilter : undefined
  const executor = clean(firstValue(searchParams, 'executor'))

  return {
    view: clean(firstValue(searchParams, 'view')),
    tab: normalizeTab(firstValue(searchParams, 'tab')),
    goalId: clean(firstValue(searchParams, 'goalId')),
    projectId: clean(firstValue(searchParams, 'projectId')),
    app: clean(firstValue(searchParams, 'app')),
    status,
    reviewStatus: normalizeReviewStatus(firstValue(searchParams, 'reviewStatus') ?? legacyReviewStatus),
    priority: clean(firstValue(searchParams, 'priority')),
    pinned: boolValue(firstValue(searchParams, 'pinned')),
    excluded: boolValue(firstValue(searchParams, 'excluded')),
    manualOnly: boolValue(firstValue(searchParams, 'manualOnly')),
    executor: executor === 'unset' || executor === 'set' ? executor : undefined,
    runnable: boolValue(firstValue(searchParams, 'runnable')),
    blocked: boolValue(firstValue(searchParams, 'blocked')),
    aiHold: boolValue(firstValue(searchParams, 'aiHold')),
    hasNextAction: boolValue(firstValue(searchParams, 'hasNextAction')),
    fixPrompt: boolValue(firstValue(searchParams, 'fixPrompt')),
    q: clean(firstValue(searchParams, 'q')),
    focusRunId: clean(firstValue(searchParams, 'focusRunId')),
  }
}

export function updateFilterParam(current: ProgressFilterState, patch: Partial<ProgressFilterState>): ProgressFilterState {
  const next: ProgressFilterState = { ...current, ...patch }
  for (const [key, value] of Object.entries(next) as Array<[keyof ProgressFilterState, unknown]>) {
    if (value === undefined || value === false || value === '') {
      delete next[key]
    }
  }

  const changesFocus = Object.keys(patch).some((key) => key !== 'focusRunId')
  if (changesFocus) delete next.focusRunId
  return next
}

export function clearFilters(current: ProgressFilterState = {}, keepKeys: Array<keyof ProgressFilterState> = []): ProgressFilterState {
  const next: ProgressFilterState = {}
  for (const key of keepKeys) {
    const value = current[key]
    if (value !== undefined && value !== false && value !== '') {
      ;(next as Record<string, unknown>)[key] = value
    }
  }
  return next
}

export function buildProgressFilterUrl(basePath: string, filters: ProgressFilterState): string {
  const params = new URLSearchParams()
  const tab = serializeTab(filters.tab)
  if (filters.view) params.set('view', filters.view)
  if (tab) params.set('tab', tab)
  if (filters.goalId) params.set('goalId', filters.goalId)
  if (filters.projectId) params.set('projectId', filters.projectId)
  if (filters.app) params.set('app', filters.app)
  if (filters.status) params.set('filter', filters.status)
  if (filters.reviewStatus) params.set('reviewStatus', filters.reviewStatus)
  if (filters.priority) params.set('priority', filters.priority)
  if (filters.pinned) params.set('pinned', '1')
  if (filters.excluded) params.set('excluded', '1')
  if (filters.manualOnly) params.set('manualOnly', '1')
  if (filters.executor) params.set('executor', filters.executor)
  if (filters.runnable) params.set('runnable', '1')
  if (filters.blocked) params.set('blocked', '1')
  if (filters.aiHold) params.set('aiHold', '1')
  if (filters.hasNextAction) params.set('hasNextAction', '1')
  if (filters.fixPrompt) params.set('fixPrompt', '1')
  if (filters.q) params.set('q', filters.q)
  if (filters.focusRunId) params.set('focusRunId', filters.focusRunId)
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
