import { isRetryableFailure } from './auto-queue-score'
import type { AutoQueueItem, AutoQueueView } from '@/types/auto-queue'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal, GoalsData } from '@/types/goal'

const JST_TIME_ZONE = 'Asia/Tokyo'
const MACHINE_SUMMARY_RE = /considered=|executed=|\[review-fix\]|0件を自動で処理|実行上限.*動きました/
const MACHINE_PREFIX_RE = /^\s*(?:[-*・]\s*)?(?:\[[^\]]+\]\s*)?(?:\[factory-runner[^\]]*\]\s*)?(?:executor=\S+\s*)?/i

export interface ReportDigest {
  date: string
  headline: string
  achievements: { app: string; text: string }[]
  progressed: { goalTitle: string; runCount: number; done: boolean }[]
  problems: { text: string; resolution: string }[]
  next: { title: string }[]
  counts: { total: number; completed: number; partial: number; failed: number; noop: number }
}

export function emptyReportDigest(date = ''): ReportDigest {
  return {
    date,
    headline: '今日はまだ自動実行の記録がありません。',
    achievements: [],
    progressed: [],
    problems: [],
    next: [],
    counts: { total: 0, completed: 0, partial: 0, failed: 0, noop: 0 },
  }
}

export function jstDateKey(iso?: string): string {
  const date = new Date(iso ?? '')
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: JST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  const year = get('year')
  const month = get('month')
  const day = get('day')
  return year && month && day ? `${year}-${month}-${day}` : ''
}

function runTime(run: ExecutionRun): number {
  const value = Date.parse(run.finishedAt || run.startedAt)
  return Number.isFinite(value) ? value : 0
}

export function isNoopRun(run: ExecutionRun): boolean {
  const summary = run.summary ?? ''
  const changedFiles = run.changedFiles?.length ?? 0
  if (MACHINE_SUMMARY_RE.test(summary)) return true
  return changedFiles === 0 && run.runStatus === 'completed'
}

export function formatAchievementText(summary: string): string {
  let text = String(summary ?? '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? ''
  text = text
    .replace(MACHINE_PREFIX_RE, '')
    .replace(/^\s*(?:[-*・]\s*)+/, '')
    .replace(/\[[\w-]+[^\]]*\]/g, '')
    .replace(/\b(?:executor|source|trigger|runs|executed|considered|blocked|skipped)=\S+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length > 80) text = text.slice(0, 80).trim()
  if (!text) return ''
  return /[。！？!?]$/.test(text) ? text : `${text}。`
}

function goalIdForRun(run: ExecutionRun, queueItemsByRunId: Map<string, AutoQueueItem>): string | undefined {
  return run.selection?.selectedGoalKey || queueItemsByRunId.get(run.runId)?.goalId
}

function goalTitleForRun(run: ExecutionRun, goalsById: Map<string, Goal>, queueItemsByRunId: Map<string, AutoQueueItem>): string | undefined {
  const goalId = goalIdForRun(run, queueItemsByRunId)
  return (goalId ? goalsById.get(goalId)?.title : undefined)
    || run.selection?.selectedGoalTitle
    || queueItemsByRunId.get(run.runId)?.goalTitle
}

function allQueueItems(queue: AutoQueueView): AutoQueueItem[] {
  return [
    ...queue.executable,
    ...queue.waitingUser,
    ...queue.held,
    ...queue.aiHold,
    ...queue.reviewWaiting,
    ...queue.blocked,
    ...queue.manual,
    ...queue.pinnedExcluded,
  ]
}

function latestRunDate(runs: ExecutionRun[]): string {
  return [...runs]
    .sort((a, b) => runTime(b) - runTime(a))
    .map((run) => jstDateKey(run.finishedAt || run.startedAt))
    .find(Boolean) ?? ''
}

function buildHeadline(achievementCount: number, progressedCount: number): string {
  if (achievementCount === 0) {
    if (progressedCount > 0) return '今日は仕込み中心の日でした（新しくできるようになったことはありません）。'
    return '今日は自動実行の記録はありますが、目に見える成果はまだありません。'
  }
  if (progressedCount > 0) return `${achievementCount}つの作業が完了し、${progressedCount}つのゴールが進みました。`
  return `${achievementCount}つの作業が完了しました。`
}

function problemResolutionForRun(run: ExecutionRun): string {
  return isRetryableFailure(run) ? '自動で再実行します' : '今日の判断に出ています'
}

export function buildReportDigestFromData(runs: ExecutionRun[], goalsData: GoalsData, queue: AutoQueueView): ReportDigest {
  try {
    const date = latestRunDate(runs)
    if (!date) return emptyReportDigest()

    const dayRuns = runs
      .filter((run) => jstDateKey(run.finishedAt || run.startedAt) === date)
      .sort((a, b) => runTime(b) - runTime(a))
    const goalsById = new Map(goalsData.goals.map((goal) => [goal.id, goal]))
    const queueItemsByRunId = new Map<string, AutoQueueItem>()
    for (const item of allQueueItems(queue)) {
      if (item.latestRunId) queueItemsByRunId.set(item.latestRunId, item)
    }

    const counts = {
      total: dayRuns.length,
      completed: dayRuns.filter((run) => run.runStatus === 'completed').length,
      partial: dayRuns.filter((run) => run.runStatus === 'partial').length,
      failed: dayRuns.filter((run) => run.runStatus === 'failed').length,
      noop: dayRuns.filter(isNoopRun).length,
    }

    const achievementKeys = new Set<string>()
    const achievements: ReportDigest['achievements'] = []
    for (const run of dayRuns) {
      if (run.runStatus !== 'completed') continue
      if ((run.changedFiles?.length ?? 0) === 0) continue
      if (isNoopRun(run)) continue
      const text = formatAchievementText(run.summary)
      if (!text) continue
      const app = run.targetApp || '対象アプリ未設定'
      const key = `${app}:${text.slice(0, 30)}`
      if (achievementKeys.has(key)) continue
      achievementKeys.add(key)
      achievements.push({ app, text })
      if (achievements.length >= 8) break
    }

    const progressedMap = new Map<string, { goalTitle: string; runCount: number; done: boolean }>()
    for (const run of dayRuns) {
      const goalId = goalIdForRun(run, queueItemsByRunId)
      if (!goalId) continue
      const goal = goalsById.get(goalId)
      const goalTitle = goal?.title || goalTitleForRun(run, goalsById, queueItemsByRunId) || goalId
      const current = progressedMap.get(goalId) ?? { goalTitle, runCount: 0, done: goal?.status === 'done' }
      current.runCount += 1
      current.done = current.done || goal?.status === 'done'
      progressedMap.set(goalId, current)
    }
    const progressed = Array.from(progressedMap.values())

    const problems: ReportDigest['problems'] = []
    for (const run of dayRuns) {
      if (run.runStatus !== 'failed') continue
      const title = run.targetTodoTitle || goalTitleForRun(run, goalsById, queueItemsByRunId) || run.targetApp || '自動実行'
      problems.push({ text: `${title}が失敗`, resolution: problemResolutionForRun(run) })
      if (problems.length >= 5) break
    }
    if (problems.length < 5) {
      for (const item of queue.blocked) {
        const latestRun = item.latestRunId ? dayRuns.find((run) => run.runId === item.latestRunId) : undefined
        problems.push({
          text: `${item.title}が止まっています`,
          resolution: latestRun && isRetryableFailure(latestRun) ? '自動で再実行します' : '今日の判断に出ています',
        })
        if (problems.length >= 5) break
      }
    }

    const next = queue.candidates.slice(0, 3).map((item) => ({ title: item.title }))

    return {
      date,
      headline: buildHeadline(achievements.length, progressed.length),
      achievements,
      progressed,
      problems,
      next,
      counts,
    }
  } catch {
    return emptyReportDigest()
  }
}

export async function buildReportDigest(_days = 1): Promise<ReportDigest> {
  try {
    const [{ readExecutionRuns }, { readGoals }, { buildAutoQueue }] = await Promise.all([
      import('./execution-run-reader'),
      import('./goal-reader'),
      import('./auto-queue'),
    ])
    const [runs, goalsData, queue] = await Promise.all([
      readExecutionRuns(),
      readGoals(),
      buildAutoQueue(),
    ])
    return buildReportDigestFromData(runs, goalsData, queue)
  } catch {
    return emptyReportDigest()
  }
}
