export const dynamic = 'force-dynamic'

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import { getAutoQueueView } from '@/lib/auto-queue'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { getEpics } from '@/lib/operations-store'
import type { Epic } from '@/lib/types/operations'
import type { AutoQueueItem, GoalProgressRow } from '@/types/auto-queue'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const UNLINKED = '__unlinked__'

type QueueBadge = {
  label: '実行可能' | '後回し中' | 'ブロック' | '待機'
  cls: string
}

type GoalRow = {
  goal: Goal
  achievement: number
  queueBadge: QueueBadge
  latestRun?: ExecutionRun
  latestRunDays?: number
  stale: boolean
  fallbackDate?: string
}

function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, pct))
  if (p >= 100) return 'bg-blue-500'
  if (p >= 60) return 'bg-green-500'
  if (p >= 30) return 'bg-amber-500'
  return 'bg-rose-400'
}

function shortText(value?: string, limit = 60): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit)}...`
}

function daysSince(value?: string): number | undefined {
  if (!value) return undefined
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return undefined
  return Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000))
}

function runTime(run: ExecutionRun): string {
  return run.finishedAt || run.startedAt
}

function queueBadge(goal: Goal, row: GoalProgressRow | undefined, executableItems: AutoQueueItem[]): QueueBadge {
  if (goal.queueControl?.hold === true) {
    return { label: '後回し中', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' }
  }
  const hasExecutable = (row?.executable ?? 0) > 0 || executableItems.some((item) => item.goalId === goal.id)
  if (hasExecutable) {
    return { label: '実行可能', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200' }
  }
  if ((row?.blocked ?? 0) > 0) {
    return { label: 'ブロック', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200' }
  }
  return { label: '待機', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200' }
}

function relatedEpicIds(goalId: string, epics: Epic[]): Set<string> {
  const ids = new Set<string>()
  for (const epic of epics) {
    if (epic.goalId === goalId || epic.epicId.startsWith(`epic-goalstep-${goalId}`)) {
      ids.add(epic.epicId)
    }
  }
  return ids
}

function latestRunForGoal(goalId: string, epics: Epic[], runs: ExecutionRun[]): ExecutionRun | undefined {
  const epicIds = relatedEpicIds(goalId, epics)
  return runs.find((run) => {
    if (!run.epicId) return false
    return epicIds.has(run.epicId) || run.epicId.startsWith(`epic-goalstep-${goalId}`)
  })
}

function projectLabel(projectId?: string): string {
  return projectId ? projectId : '未紐付け'
}

export default async function GoalDashboardPage() {
  const [data, queue, epics, runs] = await Promise.all([
    readGoals(),
    getAutoQueueView(),
    getEpics(),
    readExecutionRuns(),
  ])

  const goals = data.goals
  const activeGoals = goals.filter((goal) => goal.status === 'active')
  const doneCount = goals.filter((goal) => goal.status === 'done').length
  const progressByGoal = new Map(queue.goalProgress.map((row) => [row.goalId, row]))

  const rows: GoalRow[] = activeGoals
    .map((goal) => {
      const latestRun = latestRunForGoal(goal.id, epics, runs)
      const latestRunDays = daysSince(latestRun ? runTime(latestRun) : undefined)
      const fallbackDate = latestRun ? undefined : goal.updatedAt
      const staleDays = latestRunDays ?? daysSince(fallbackDate) ?? 0
      return {
        goal,
        achievement: goalAchievement(goal),
        queueBadge: queueBadge(goal, progressByGoal.get(goal.id), queue.executable),
        latestRun,
        latestRunDays,
        stale: staleDays >= 7,
        fallbackDate,
      }
    })
    .sort((a, b) => a.achievement - b.achievement || a.goal.title.localeCompare(b.goal.title, 'ja'))

  const executableCount = rows.filter((row) => row.queueBadge.label === '実行可能').length
  const staleCount = rows.filter((row) => row.stale).length
  const groups = Array.from(
    rows.reduce((map, row) => {
      const key = row.goal.projectId || UNLINKED
      const group = map.get(key)
      if (group) group.push(row)
      else map.set(key, [row])
      return map
    }, new Map<string, GoalRow[]>())
  ).sort(([a], [b]) => {
    if (a === UNLINKED) return 1
    if (b === UNLINKED) return -1
    return a.localeCompare(b, 'ja')
  })

  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <PageGuide
        title="ゴール進行ボード"
        guide="ゴールごとの実際の進み具合（自動実行の動き）を見る画面です"
      />

      <section className={`${card} border-2 border-blue-100 dark:border-blue-900/50`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Summary label="active" value={activeGoals.length} />
          <Summary label="実行可能" value={executableCount} tone="green" />
          <Summary label="停滞" value={staleCount} tone="amber" />
          <Summary label="done" value={doneCount} tone="blue" />
        </div>
      </section>

      {groups.length === 0 ? (
        <section className={card}>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">実行中のゴールはありません。</p>
        </section>
      ) : (
        groups.map(([projectId, groupRows]) => (
          <section key={projectId} className={card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="break-words text-sm font-black text-gray-900 dark:text-gray-100">
                  {projectLabel(projectId === UNLINKED ? undefined : projectId)}
                </h2>
                <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                  active goal {groupRows.length}件
                </p>
              </div>
              {projectId === UNLINKED ? (
                <Link href="/goal-planner" className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-800 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-100">
                  紐付ける
                </Link>
              ) : null}
            </div>

            <ul className="mt-3 space-y-2">
              {groupRows.map((row) => (
                <GoalProgressItem key={row.goal.id} row={row} />
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  )
}

function Summary({ label, value, tone = 'gray' }: { label: string; value: number; tone?: 'gray' | 'green' | 'amber' | 'blue' }) {
  const cls =
    tone === 'green'
      ? 'text-green-700 dark:text-green-200'
      : tone === 'amber'
        ? 'text-amber-700 dark:text-amber-200'
        : tone === 'blue'
          ? 'text-blue-700 dark:text-blue-200'
          : 'text-gray-900 dark:text-gray-100'
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800/50">
      <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 text-xl font-black ${cls}`}>{value}</p>
    </div>
  )
}

function GoalProgressItem({ row }: { row: GoalRow }) {
  const dateText = row.latestRun
    ? `${row.latestRunDays ?? 0}日前`
    : 'まだ実行なし'
  const summary = shortText(row.latestRun?.summary)
  return (
    <li className={`rounded-xl border p-3 ${row.stale ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20' : 'border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-950/30'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-black leading-snug text-gray-900 dark:text-gray-100">{row.goal.title}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={`rounded px-2 py-0.5 text-[10px] font-black ${row.queueBadge.cls}`}>{row.queueBadge.label}</span>
            {row.stale ? (
              <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-900 dark:bg-amber-900/70 dark:text-amber-100">
                7日以上停滞
              </span>
            ) : null}
            <span className="rounded bg-white px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
              {dateText}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-black text-gray-900 dark:text-gray-100">{row.achievement}%</p>
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">{row.goal.current ?? 0}/{row.goal.target ?? 100}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={`h-full rounded-full ${bar(row.achievement)}`} style={{ width: `${Math.max(2, Math.min(100, row.achievement))}%` }} />
      </div>
      <p className="mt-2 min-h-[1rem] break-words text-[11px] leading-snug text-gray-500 dark:text-gray-400">
        {summary || (row.latestRun ? 'summaryなし' : 'このゴール配下のrunはまだありません')}
      </p>
    </li>
  )
}
