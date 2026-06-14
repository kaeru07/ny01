import { readJson, writeJson } from '@/lib/store'
import { readAppProgress } from '@/lib/progress-reader'
import { readGoals, calcGoalProgress } from '@/lib/goal-reader'
import type { Goal } from '@/types/goal'
import type { Project } from '@/types/progress'
import type {
  PromptQueueCandidate,
  PromptQueueImportResult,
  PromptQueueInput,
  PromptQueueItem,
  PromptQueueStatus,
  PromptQueueView,
} from '@/types/prompt-queue'

interface PromptQueueRegistry {
  updatedAt: string
  items: PromptQueueItem[]
}

export const PROMPT_QUEUE_FILE = 'prompt-queue.json'

export const PROMPT_QUEUE_STATUSES: PromptQueueStatus[] = [
  'queued',
  'reserved',
  'not_started',
  'running',
  'completed',
  'failed',
  'needs_retry',
  'needs_user_prompt_fix',
  'needs_review',
  'canceled',
  'snoozed',
  'archived',
]

const NEXT_CANDIDATE_STATUSES = new Set<PromptQueueStatus>([
  'queued',
  'reserved',
  'not_started',
  'failed',
  'needs_retry',
  'needs_user_prompt_fix',
])

const CLOSED_STATUSES = new Set<PromptQueueStatus>(['completed', 'canceled', 'snoozed', 'archived'])
const EMPTY_REGISTRY: PromptQueueRegistry = { updatedAt: '', items: [] }

function nowIso(): string {
  return new Date().toISOString()
}

function genId(): string {
  return `pq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function validStatus(value: unknown): PromptQueueStatus {
  return typeof value === 'string' && PROMPT_QUEUE_STATUSES.includes(value as PromptQueueStatus)
    ? value as PromptQueueStatus
    : 'queued'
}

function sameKey(a?: string, b?: string): boolean {
  if (!a || !b) return false
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  return x === y || x.includes(y) || y.includes(x)
}

function findProject(projects: Project[], value: unknown): Project | undefined {
  const raw = clean(value)
  if (!raw) return undefined
  return projects.find((p) => sameKey(p.id, raw) || sameKey(p.name, raw))
}

function findGoal(goals: Goal[], value: unknown): Goal | undefined {
  const raw = clean(value)
  if (!raw) return undefined
  return goals.find((g) => sameKey(g.id, raw) || sameKey(g.title, raw))
}

export async function readPromptQueueRegistry(): Promise<PromptQueueRegistry> {
  const registry = await readJson<PromptQueueRegistry>(PROMPT_QUEUE_FILE, EMPTY_REGISTRY)
  return {
    updatedAt: typeof registry.updatedAt === 'string' ? registry.updatedAt : '',
    items: Array.isArray(registry.items) ? registry.items : [],
  }
}

export async function writePromptQueueRegistry(registry: PromptQueueRegistry): Promise<void> {
  await writeJson<PromptQueueRegistry>(PROMPT_QUEUE_FILE, registry)
}

export function normalizePromptQueueInput(input: PromptQueueInput, fallbackSource: PromptQueueItem['source'] = 'manual'): Omit<PromptQueueItem, 'id' | 'createdAt' | 'updatedAt'> {
  const status = validStatus(input.status)
  return {
    title: clean(input.title),
    prompt: clean(input.prompt),
    projectId: clean(input.projectId) || undefined,
    projectName: clean(input.projectName) || undefined,
    goalProgressId: clean(input.goalProgressId) || undefined,
    goalProgressTitle: clean(input.goalProgressTitle) || undefined,
    status,
    source: input.source ?? fallbackSource,
    notes: clean(input.notes) || undefined,
    relatedInboxId: clean(input.relatedInboxId) || undefined,
    relatedReviewId: clean(input.relatedReviewId) || undefined,
    relatedUrl: clean(input.relatedUrl) || undefined,
    executionRunId: clean(input.executionRunId) || undefined,
    resultSummary: clean(input.resultSummary) || undefined,
    errorMessage: clean(input.errorMessage) || undefined,
    preferredExecutor: 'auto',
    goalId: clean(input.goalProgressId) || undefined,
    goalTitle: clean(input.goalProgressTitle) || undefined,
  }
}

export function validatePromptQueueInput(input: PromptQueueInput): string[] {
  const errors: string[] = []
  if (!clean(input.title)) errors.push('title is required')
  if (!clean(input.prompt)) errors.push('prompt is required')
  if (!clean(input.projectId)) errors.push('projectId is required')
  if (!clean(input.goalProgressId)) errors.push('goalProgressId is required')
  return errors
}

export async function addPromptQueueItem(input: PromptQueueInput): Promise<PromptQueueItem> {
  const errors = validatePromptQueueInput(input)
  if (errors.length > 0) throw new Error(errors.join(', '))
  const registry = await readPromptQueueRegistry()
  const ts = nowIso()
  const item: PromptQueueItem = {
    id: genId(),
    createdAt: ts,
    updatedAt: ts,
    ...normalizePromptQueueInput(input, input.source ?? 'manual'),
  }
  await writePromptQueueRegistry({ updatedAt: ts, items: [item, ...registry.items] })
  return item
}

export async function updatePromptQueueItem(id: string, patch: PromptQueueInput): Promise<PromptQueueItem | null> {
  const registry = await readPromptQueueRegistry()
  const idx = registry.items.findIndex((item) => item.id === id)
  if (idx === -1) return null
  const prev = registry.items[idx]
  const ts = nowIso()
  const nextStatus = patch.status ? validStatus(patch.status) : prev.status
  const next: PromptQueueItem = {
    ...prev,
    ...(patch.title !== undefined ? { title: clean(patch.title) } : {}),
    ...(patch.prompt !== undefined ? { prompt: clean(patch.prompt) } : {}),
    ...(patch.projectId !== undefined ? { projectId: clean(patch.projectId) || undefined } : {}),
    ...(patch.projectName !== undefined ? { projectName: clean(patch.projectName) || undefined } : {}),
    ...(patch.goalProgressId !== undefined ? { goalProgressId: clean(patch.goalProgressId) || undefined, goalId: clean(patch.goalProgressId) || undefined } : {}),
    ...(patch.goalProgressTitle !== undefined ? { goalProgressTitle: clean(patch.goalProgressTitle) || undefined, goalTitle: clean(patch.goalProgressTitle) || undefined } : {}),
    ...(patch.notes !== undefined ? { notes: clean(patch.notes) || undefined } : {}),
    ...(patch.relatedInboxId !== undefined ? { relatedInboxId: clean(patch.relatedInboxId) || undefined } : {}),
    ...(patch.relatedReviewId !== undefined ? { relatedReviewId: clean(patch.relatedReviewId) || undefined } : {}),
    ...(patch.relatedUrl !== undefined ? { relatedUrl: clean(patch.relatedUrl) || undefined } : {}),
    ...(patch.executionRunId !== undefined ? { executionRunId: clean(patch.executionRunId) || undefined } : {}),
    ...(patch.resultSummary !== undefined ? { resultSummary: clean(patch.resultSummary) || undefined } : {}),
    ...(patch.errorMessage !== undefined ? { errorMessage: clean(patch.errorMessage) || undefined } : {}),
    status: nextStatus,
    ...(nextStatus === 'running' && !prev.startedAt ? { startedAt: ts } : {}),
    ...(nextStatus === 'completed' && !prev.completedAt ? { completedAt: ts } : {}),
    updatedAt: ts,
  }
  const items = [...registry.items]
  items[idx] = next
  await writePromptQueueRegistry({ updatedAt: ts, items })
  return next
}

export async function archivePromptQueueItem(id: string): Promise<PromptQueueItem | null> {
  return updatePromptQueueItem(id, { status: 'archived' })
}

function projectRank(project?: Project): number {
  if (!project) return 5
  if (project.status === 'user_action_pending' || project.status === 'deploy_ready') return 0
  if (project.status === 'in_progress') return 1
  if (project.status === 'active') return 2
  if (project.status === 'blocked') return 3
  return 4
}

function goalIsOpen(goal?: Goal): boolean {
  if (!goal) return false
  if (goal.status === 'done' || goal.status === 'dropped' || goal.status === 'archived') return false
  return calcGoalProgress(goal).ratio < 100 || goal.todos.some((todo) => todo.status !== 'done' && todo.status !== 'skipped')
}

function candidateReason(item: PromptQueueItem, project?: Project, goal?: Goal): string {
  if (item.status === 'reserved') return 'ユーザーが作業予約したため'
  if (item.status === 'failed' || item.status === 'needs_retry') return '前回失敗のため'
  if (item.status === 'needs_user_prompt_fix') return 'プロンプト修正が必要なため'
  if (goalIsOpen(goal)) return 'Goal進捗が未完了のため'
  if (project && ['in_progress', 'active', 'deploy_ready', 'user_action_pending'].includes(project.status)) return 'Projectが進行中のため'
  return '未実行のため'
}

function compareCandidate(a: PromptQueueItem, b: PromptQueueItem, projects: Map<string, Project>, goals: Map<string, Goal>): number {
  const ap = projects.get(a.projectId ?? '')
  const bp = projects.get(b.projectId ?? '')
  const pr = projectRank(ap) - projectRank(bp)
  if (pr !== 0) return pr
  const ag = goalIsOpen(goals.get(a.goalProgressId ?? '')) ? 0 : 1
  const bg = goalIsOpen(goals.get(b.goalProgressId ?? '')) ? 0 : 1
  if (ag !== bg) return ag - bg
  const af = a.status === 'failed' || a.status === 'needs_retry' ? 0 : 1
  const bf = b.status === 'failed' || b.status === 'needs_retry' ? 0 : 1
  if (af !== bf) return af - bf
  const aq = a.status === 'queued' || a.status === 'not_started' ? Date.parse(a.createdAt) : Number.POSITIVE_INFINITY
  const bq = b.status === 'queued' || b.status === 'not_started' ? Date.parse(b.createdAt) : Number.POSITIVE_INFINITY
  if (Number.isFinite(aq) && Number.isFinite(bq) && aq !== bq) return aq - bq
  return Date.parse(b.createdAt) - Date.parse(a.createdAt)
}

export async function buildPromptQueueView(): Promise<PromptQueueView> {
  const [registry, progress, goalsData] = await Promise.all([
    readPromptQueueRegistry(),
    readAppProgress(),
    readGoals(),
  ])
  const projectById = new Map(progress.projects.map((project) => [project.id, project]))
  const goalById = new Map(goalsData.goals.map((goal) => [goal.id, goal]))
  const counts = Object.fromEntries(PROMPT_QUEUE_STATUSES.map((status) => [status, 0])) as Record<PromptQueueStatus, number>
  for (const item of registry.items) counts[item.status] = (counts[item.status] ?? 0) + 1
  const nextCandidates: PromptQueueCandidate[] = registry.items
    .filter((item) => NEXT_CANDIDATE_STATUSES.has(item.status) && !CLOSED_STATUSES.has(item.status))
    .sort((a, b) => compareCandidate(a, b, projectById, goalById))
    .map((item, index) => ({
      ...item,
      candidateOrder: index + 1,
      candidateReason: candidateReason(item, projectById.get(item.projectId ?? ''), goalById.get(item.goalProgressId ?? '')),
    }))
  return {
    updatedAt: registry.updatedAt,
    items: registry.items,
    nextCandidates,
    counts,
  }
}

function rawItemsFromImport(parsed: unknown): { items: unknown[]; root: 'promptQueue' | 'todos' | 'array' } | { error: string } {
  if (Array.isArray(parsed)) return { items: parsed, root: 'array' }
  if (typeof parsed !== 'object' || parsed === null) return { error: 'JSONはオブジェクトまたは配列で指定してください' }
  const obj = parsed as Record<string, unknown>
  if (Array.isArray(obj.promptQueue)) return { items: obj.promptQueue, root: 'promptQueue' }
  if (Array.isArray(obj.todos)) return { items: obj.todos, root: 'todos' }
  return { error: '形式が不正です。{"promptQueue":[...]} または {"todos":[...]} を指定してください' }
}

export async function importPromptQueueJson(payload: unknown): Promise<PromptQueueImportResult> {
  const source = rawItemsFromImport(payload)
  if ('error' in source) return { imported: 0, warnings: [], errors: [source.error], items: [] }
  const [registry, progress, goalsData] = await Promise.all([readPromptQueueRegistry(), readAppProgress(), readGoals()])
  const warnings: string[] = []
  const errors: string[] = []
  const imported: PromptQueueItem[] = []
  const ts = nowIso()

  for (let i = 0; i < source.items.length; i += 1) {
    const raw = source.items[i]
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push(`${i + 1}件目: オブジェクトではありません`)
      continue
    }
    const item = raw as Record<string, unknown>
    const title = clean(item.title)
    const prompt = clean(item.prompt) || clean(item.taskPrompt)
    if (!title) {
      errors.push(`${i + 1}件目: titleがありません`)
      continue
    }
    if (!prompt) {
      errors.push(`${i + 1}件目: promptがありません`)
      continue
    }
    if (item.priority !== undefined) warnings.push(`${i + 1}件目: priorityはPrompt Queueでは使わないため無視しました`)
    if (item.assignee !== undefined) warnings.push(`${i + 1}件目: assigneeはPrompt Queueでは使わないため無視しました`)
    if (item.preferredExecutor !== undefined) warnings.push(`${i + 1}件目: preferredExecutorはPrompt Queueでは使わないため無視しました`)

    const projectValue = item.project ?? item.projectId ?? item.projectName
    const project = findProject(progress.projects, projectValue)
    if (!clean(projectValue)) warnings.push(`${i + 1}件目: projectが未指定です（未紐付けProjectとして取り込み）`)
    else if (!project) warnings.push(`${i + 1}件目: project「${clean(projectValue)}」に一致する既存Projectがありません（未紐付けProjectとして取り込み）`)

    const goalValue = item.goalProgress ?? item.goalProgressId ?? item.goalProgressTitle ?? item.goal
    const goal = findGoal(goalsData.goals, goalValue)
    if (item.goal !== undefined && item.goalProgress === undefined) warnings.push(`${i + 1}件目: goalをgoalProgressとして正規化しました`)
    if (!clean(goalValue)) warnings.push(`${i + 1}件目: Goal進捗が未指定です`)
    else if (!goal) warnings.push(`${i + 1}件目: Goal進捗「${clean(goalValue)}」に一致する既存Goalがありません`)

    const status = validStatus(item.status)
    const queueItem: PromptQueueItem = {
      id: genId(),
      title,
      prompt,
      projectId: project?.id,
      projectName: project?.name ?? (clean(projectValue) || undefined),
      goalProgressId: goal?.id,
      goalProgressTitle: goal?.title ?? (clean(goalValue) || undefined),
      goalId: goal?.id,
      goalTitle: goal?.title ?? (clean(goalValue) || undefined),
      status,
      source: 'json_import',
      createdAt: ts,
      updatedAt: ts,
      notes: clean(item.notes) || undefined,
      relatedInboxId: clean(item.relatedInboxId) || undefined,
      relatedReviewId: clean(item.relatedReviewId) || undefined,
      relatedUrl: clean(item.relatedUrl) || undefined,
      preferredExecutor: 'auto',
    }
    imported.push(queueItem)
  }

  if (imported.length > 0) {
    await writePromptQueueRegistry({ updatedAt: ts, items: [...imported, ...registry.items] })
  }

  return { imported: imported.length, warnings, errors, items: imported }
}
