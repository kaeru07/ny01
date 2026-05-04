import type { WorkQueueItem } from '@/types/session'

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
