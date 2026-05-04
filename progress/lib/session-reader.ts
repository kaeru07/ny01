import fs from 'fs/promises'
import path from 'path'
import { getDataPath } from '@/lib/progress-reader'
import type { WorkCandidatesData, WorkQueueData, WorkSession, WorkQueueItem } from '@/types/session'

const EMPTY_CANDIDATES: WorkCandidatesData = { candidates: [], lastRefreshed: '' }
const EMPTY_QUEUE: WorkQueueData = { items: [], lastGenerated: '' }

function todayJST(): string {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-')
}

function defaultSession(): WorkSession {
  const now = new Date().toISOString()
  return { date: todayJST(), status: 'pending', handoffText: '', createdAt: now, updatedAt: now }
}

export async function readWorkCandidates(): Promise<WorkCandidatesData> {
  try {
    const content = await fs.readFile(path.join(getDataPath(), 'work-candidates.json'), 'utf-8')
    return JSON.parse(content) as WorkCandidatesData
  } catch {
    return EMPTY_CANDIDATES
  }
}

export async function readWorkQueue(): Promise<WorkQueueData> {
  try {
    const content = await fs.readFile(path.join(getDataPath(), 'work-queue.json'), 'utf-8')
    return JSON.parse(content) as WorkQueueData
  } catch {
    return EMPTY_QUEUE
  }
}

export async function readWorkSession(): Promise<WorkSession> {
  try {
    const content = await fs.readFile(path.join(getDataPath(), 'today-session.json'), 'utf-8')
    return JSON.parse(content) as WorkSession
  } catch {
    return defaultSession()
  }
}

export function getEffectiveOrder(item: Pick<WorkQueueItem, 'autoOrder' | 'manualOrder'>): number {
  return item.manualOrder ?? item.autoOrder
}

export function sortedQueueItems(items: WorkQueueItem[]): WorkQueueItem[] {
  return [...items].sort((a, b) => getEffectiveOrder(a) - getEffectiveOrder(b))
}

export function calcCandidateScore(priority: string, effort: string): number {
  const p = { high: 30, medium: 20, low: 10 }[priority] ?? 10
  const e = { small: 5, medium: 0, large: -5 }[effort] ?? 0
  return p + e
}
