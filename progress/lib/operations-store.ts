import { readJson, writeJson, appendNdjson, readNdjson } from './store'
import type {
  Epic,
  Approval,
  ApprovalPriority,
  OperationalDecision,
  HealthSummary,
} from './types/operations'
import type { WorkQueueData } from '@/types/session'
import type { AppProgress } from '@/types/progress'

const PRIORITY_ORDER: Record<ApprovalPriority, number> = {
  critical: 0,
  high: 1,
  low: 2,
}

// ---- Epics ----

export async function getEpics(): Promise<Epic[]> {
  return readJson<Epic[]>('epics.json', [])
}

export async function updateEpic(epicId: string, patch: Partial<Epic>): Promise<Epic | null> {
  const epics = await getEpics()
  const idx = epics.findIndex((e) => e.epicId === epicId)
  if (idx === -1) return null
  const updated: Epic = { ...epics[idx], ...patch, epicId }
  epics[idx] = updated
  await writeJson('epics.json', epics)
  return updated
}

// ---- Approvals ----

export async function getApprovals(): Promise<Approval[]> {
  return readJson<Approval[]>('approvals.json', [])
}

export async function getPendingApprovals(): Promise<Approval[]> {
  const approvals = await getApprovals()
  return approvals
    .filter((a) => a.status === 'pending')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
}

export async function decideApproval(
  approvalId: string,
  decidedOption: string,
  decidedBy = 'operator',
): Promise<Approval | null> {
  const approvals = await getApprovals()
  const idx = approvals.findIndex((a) => a.approvalId === approvalId)
  if (idx === -1) return null

  const now = new Date().toISOString()
  const decided: Approval = {
    ...approvals[idx],
    status: 'decided',
    decidedOption,
    decidedBy,
    decidedAt: now,
  }
  approvals[idx] = decided
  await writeJson('approvals.json', approvals)

  const decision: OperationalDecision = {
    decisionId: `dec-${Date.now()}`,
    epicId: decided.epicId,
    topic: decided.title,
    decision: decidedOption,
    approvalId: decided.approvalId,
    decidedAt: now,
  }
  await appendNdjson('operational-decisions.ndjson', decision)

  return decided
}

// ---- Operational decisions ----

export async function getOperationalDecisions(): Promise<OperationalDecision[]> {
  return readNdjson<OperationalDecision>('operational-decisions.ndjson')
}

// ---- Health summary (read-only aggregation, no new persistence) ----

const STALE_DAYS = 7
const STALE_STATUSES = ['in_progress', 'active']

export async function computeHealthSummary(): Promise<HealthSummary> {
  const workQueue = await readJson<WorkQueueData>('work-queue.json', { items: [], lastGenerated: '' })
  const appProgress = await readJson<AppProgress>('app-progress.json', { projects: [] })
  const pending = await getPendingApprovals()
  const epics = await getEpics()

  const runnable = workQueue.items.filter((q) => q.status === 'queued').length
  const running = workQueue.items.filter((q) => q.status === 'in_progress').length
  const stopped = workQueue.items.filter((q) => q.status === 'blocked').length
  const epicsActive = epics.filter((e) => e.status === 'active').length

  const now = Date.now()
  const stale = appProgress.projects.filter((app) => {
    if (!STALE_STATUSES.includes(app.status)) return false
    const updated = Date.parse(app.updatedAt)
    if (Number.isNaN(updated)) return false
    const ageDays = (now - updated) / (1000 * 60 * 60 * 24)
    return ageDays >= STALE_DAYS
  }).length

  return {
    runnable,
    running,
    pendingApproval: pending.length,
    limitWaiting: 0,
    stopped,
    epicsActive,
    stale,
  }
}
