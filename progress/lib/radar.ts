import type { Project } from '@/types/progress'
import type { WorkQueueItem } from '@/types/session'
import type { ExecutionRun } from '@/types/execution-run'

export type RadarStatus = '着手' | '進行中' | 'レビュー待ち' | '停止' | '放置' | '完了'
export type RevenueImpact = 'high' | 'medium' | 'low'

export interface RadarProject {
  id: string
  name: string
  status: RadarStatus
  rawStatus: string
  progress: number
  updatedAt: string
  staleDays: number
  phase: string
  current: string
  nextStep: string
  estimate: string
  revenue: RevenueImpact
  blockers: string[]
  relatedTodos: string[]
  latestRun?: {
    runId: string
    runStatus: string
    reviewStatus: string
    finishedAt: string
    title: string
  }
  url?: string
}

export interface TopFocus {
  projectId: string
  name: string
  nextStep: string
  estimate: string
  reason: string
}

const ACTIVE = ['in_progress', 'active']
const DONE = ['done']

export function daysSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000))
}

function firstLine(s: string): string {
  return (s || '').split('\n')[0].trim()
}

// 次の1手: work-queue の active item → project.nextAction → blocker解消 の優先順
function deriveNextStep(p: Project, queued: WorkQueueItem[]): string {
  const q = queued.find((i) => i.projectId === p.id && (i.status === 'queued' || i.status === 'in_progress'))
  if (q && q.taskTitle) return firstLine(q.taskTitle)
  if (p.blockers.length > 0 && (p.status === 'blocked')) return `ブロッカー解消: ${firstLine(p.blockers[0])}`
  if (p.nextAction && p.nextAction.trim()) return firstLine(p.nextAction)
  if (p.blockers.length > 0) return `ブロッカー解消: ${firstLine(p.blockers[0])}`
  return '次の1手が未設定（要確認）'
}

// 収益インパクト: 専用フィールドが無いため既存データから推定（手入力項目は増やさない）
function deriveRevenue(p: Project): RevenueImpact {
  const r = (p as unknown as { revenueImpact?: string }).revenueImpact
  if (r === 'high' || r === 'medium' || r === 'low') return r
  if ((p.status === 'deploy_ready' || p.status === 'user_action_pending') && p.url) return 'high'
  if (p.url && p.progress >= 70) return 'high'
  if (p.url || p.progress >= 50) return 'medium'
  return 'low'
}

function deriveStatus(
  p: Project,
  staleDays: number,
  hasUnreviewedRun: boolean,
  hasActiveQueue: boolean
): RadarStatus {
  if (DONE.includes(p.status) || p.progress >= 100) return '完了'
  if (p.status === 'blocked' || p.blockers.length > 0) return '停止'
  if (hasUnreviewedRun) return 'レビュー待ち'
  if (ACTIVE.includes(p.status) && staleDays >= 7) return '放置'
  if (p.status === 'in_progress' || hasActiveQueue) return '進行中'
  return '着手'
}

function deriveEstimate(status: RadarStatus, q?: WorkQueueItem): string {
  if (q?.doneCondition && q.doneCondition.length > 0 && q.doneCondition.length < 24) return '15分'
  switch (status) {
    case 'レビュー待ち':
      return '5分'
    case '停止':
      return '要判断'
    case '放置':
      return '15分'
    case '完了':
      return '—'
    default:
      return '15分'
  }
}

export function buildRadar(
  projects: Project[],
  queue: WorkQueueItem[],
  runs: ExecutionRun[],
  now: Date = new Date()
): RadarProject[] {
  const latestByApp = new Map<string, ExecutionRun>()
  for (const r of runs) {
    const key = r.targetApp
    const cur = latestByApp.get(key)
    if (!cur || new Date(r.finishedAt).getTime() > new Date(cur.finishedAt).getTime()) {
      latestByApp.set(key, r)
    }
  }

  return projects
    .filter((p) => !p.excluded)
    .map((p) => {
      const staleDays = daysSince(p.updatedAt, now)
      const run =
        latestByApp.get(p.id) ||
        latestByApp.get(p.name) ||
        runs.find((r) => r.targetApp.includes(p.id) || (p.id && r.targetApp.endsWith(p.id)))
      const hasUnreviewedRun =
        !!run &&
        run.runStatus !== 'running' &&
        (run.reviewStatus === 'not_reviewed' || run.reviewStatus === 'copied')
      const activeQ = queue.find(
        (i) => i.projectId === p.id && (i.status === 'queued' || i.status === 'in_progress')
      )
      const status = deriveStatus(p, staleDays, hasUnreviewedRun, !!activeQ)
      const relatedTodos = queue
        .filter((i) => i.projectId === p.id && i.status !== 'done')
        .map((i) => firstLine(i.taskTitle))
        .slice(0, 5)
      return {
        id: p.id,
        name: p.name,
        status,
        rawStatus: p.status,
        progress: p.progress,
        updatedAt: p.updatedAt,
        staleDays,
        phase: p.phase,
        current: firstLine(p.currentTask),
        nextStep: deriveNextStep(p, queue),
        estimate: deriveEstimate(status, activeQ),
        revenue: deriveRevenue(p),
        blockers: p.blockers,
        relatedTodos,
        latestRun: run
          ? {
              runId: run.runId,
              runStatus: run.runStatus,
              reviewStatus: run.reviewStatus,
              finishedAt: run.finishedAt,
              title: run.targetTodoTitle,
            }
          : undefined,
        url: p.url,
      }
    })
}

const STATUS_RANK: Record<RadarStatus, number> = {
  放置: 5,
  レビュー待ち: 4,
  停止: 3,
  進行中: 2,
  着手: 1,
  完了: 0,
}
const REV_RANK: Record<RevenueImpact, number> = { high: 2, medium: 1, low: 0 }

// 今やるべき1件: 着手可能（停止/完了以外）の中で 収益・放置・レビュー待ち を加味して1件
export function pickTopFocus(radar: RadarProject[]): TopFocus | null {
  const actionable = radar.filter((r) => r.status !== '完了' && r.status !== '停止')
  const pool = actionable.length > 0 ? actionable : radar.filter((r) => r.status !== '完了')
  if (pool.length === 0) return null
  const scored = [...pool].sort((a, b) => {
    const sb =
      REV_RANK[b.revenue] * 4 + STATUS_RANK[b.status] * 3 + Math.min(b.staleDays, 30)
    const sa =
      REV_RANK[a.revenue] * 4 + STATUS_RANK[a.status] * 3 + Math.min(a.staleDays, 30)
    return sb - sa
  })
  const t = scored[0]
  const reasons: string[] = []
  if (t.revenue === 'high') reasons.push('収益インパクト高')
  if (t.staleDays >= 14) reasons.push(`${t.staleDays}日放置`)
  else if (t.staleDays >= 7) reasons.push(`${t.staleDays}日放置`)
  if (t.status === 'レビュー待ち') reasons.push('レビュー待ち')
  if (t.status === '停止') reasons.push('停止中')
  return {
    projectId: t.id,
    name: t.name,
    nextStep: t.nextStep,
    estimate: t.estimate,
    reason: reasons.join(' / ') || '進行中で次の1手あり',
  }
}

// ガント横軸の日付レンジ（直近 days 日）
export function ganttDates(days = 21, now: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function statusColor(status: RadarStatus, staleDays: number): string {
  if (status === '放置' && staleDays >= 14) return 'bg-red-500'
  if (status === '放置') return 'bg-yellow-400'
  if (status === 'レビュー待ち') return 'bg-blue-500'
  if (status === '停止') return 'bg-red-400'
  if (status === '完了') return 'bg-green-500'
  if (status === '進行中') return 'bg-emerald-500'
  return 'bg-gray-400'
}
