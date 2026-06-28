export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { goalAchievement, readGoals } from '@/lib/goal-reader'
import { humanizeTitle, shorten, subjectOf } from '@/lib/humanize'
import { getEpics } from '@/lib/operations-store'
import type { ExecutionRun } from '@/types/execution-run'
import type { Goal } from '@/types/goal'

type PeriodKey = 'day' | 'week' | 'month'
type RepeatedEpicRow = {
  key: string
  runs: ExecutionRun[]
  count: number
  completed: number
  partial: number
  failed: number
  running: number
}

const card = 'rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900'
const subtleCard = 'rounded-lg bg-gray-50 p-2.5 dark:bg-gray-950/35'
const periodOptions: Array<{ key: PeriodKey; label: string }> = [
  { key: 'day', label: '日' },
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
]

function isAutoRun(r: ExecutionRun): boolean {
  return r.factoryRun === true || (typeof r.source === 'string' && /factory|schedule|boot/.test(r.source))
}

function ts(iso?: string): number {
  const t = Date.parse(iso ?? '')
  return Number.isNaN(t) ? 0 : t
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

function periodRange(period: PeriodKey): { start: Date; end: Date; label: string } {
  const now = new Date()
  const today = startOfDay(now)
  if (period === 'day') {
    return {
      start: today,
      end: addDays(today, 1),
      label: now.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
    }
  }
  if (period === 'month') {
    return {
      start: new Date(now.getFullYear(), now.getMonth(), 1),
      end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      label: '今月',
    }
  }
  const day = today.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = addDays(today, mondayOffset)
  return { start, end: addDays(start, 7), label: '今週' }
}

function runTime(r: ExecutionRun): number {
  return ts(r.finishedAt || r.startedAt)
}

function inRange(iso: string | undefined, start: Date, end: Date): boolean {
  const t = ts(iso)
  return t >= start.getTime() && t < end.getTime()
}

function durationMs(r: ExecutionRun): number {
  const start = ts(r.startedAt)
  const end = ts(r.finishedAt)
  if (!start || !end || end < start) return 0
  return end - start
}

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min <= 0) return '0分'
  if (min < 60) return `${min}分`
  const hour = Math.floor(min / 60)
  const rest = min % 60
  return rest ? `${hour}時間${rest}分` : `${hour}時間`
}

function displayTitle(r: ExecutionRun): string {
  return shorten(subjectOf(humanizeTitle(r.targetTodoTitle || r.summary || '自動実行')), 34)
}

function appLabel(app?: string): string {
  const raw = (app || '未設定').trim()
  const lower = raw.toLowerCase()
  if (lower.includes('company-mgmt')) return 'company-mgmt'
  if (lower.includes('progress')) return 'progress'
  return shorten(raw, 18)
}

function statusLabel(status: ExecutionRun['runStatus']): string {
  if (status === 'completed') return '完了'
  if (status === 'partial') return '一部'
  if (status === 'failed') return '失敗'
  return '実行中'
}

function statusBadgeClass(status: ExecutionRun['runStatus']): string {
  if (status === 'completed') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
  if (status === 'partial') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
  if (status === 'failed') return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
}

function fmtShortDateTime(iso?: string): string {
  const t = ts(iso)
  if (!t) return '-'
  return new Date(t).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function runPeriodLabel(r: ExecutionRun): string {
  const start = fmtShortDateTime(r.startedAt)
  const finished = fmtShortDateTime(r.finishedAt)
  if (finished === '-' || finished === start) return start
  return `${start}→${finished}`
}

function humanStopReason(reason?: string): string {
  const raw = (reason || '').trim()
  if (!raw) return '停止理由未記録'
  const ratio = raw.match(/doneCriteria\s+([0-9]+)\s*\/\s*([0-9]+)/i)
  if (/continue/i.test(raw)) {
    return ratio ? `未達のため次回へ継続（DoneCriteria ${ratio[1]}/${ratio[2]}）` : '未達のため次回へ継続'
  }
  if (/epic_done/i.test(raw)) {
    return ratio ? `Epic完了（DoneCriteria ${ratio[1]}/${ratio[2]}）` : 'Epic完了'
  }
  if (/max_per_epic_reached|max_runs_reached/i.test(raw)) return '上限回数に到達'
  if (/approval_required/i.test(raw)) return '承認待ちで停止'
  if (/run_failed/i.test(raw)) return '実行失敗で停止'
  if (/blocked/i.test(raw)) return 'ブロック中'
  if (/manual_execution_pending/i.test(raw)) return '手動実行待ち'
  if (/claude_rate_limited/i.test(raw)) return 'Claude上限で停止'
  return humanizeTitle(raw)
}

function doneCriteriaNote(r: ExecutionRun): string | null {
  const status = r.doneCriteriaStatus?.trim()
  const ratio = r.stopReason?.match(/doneCriteria\s+([0-9]+)\s*\/\s*([0-9]+)/i)
  if (!status && !ratio) return null
  const ratioText = ratio ? `DoneCriteria ${ratio[1]}/${ratio[2]}` : null
  if (status === 'done') return ratioText ? `${ratioText} 達成` : 'DoneCriteria達成'
  if (status === 'continue') return ratioText ? `${ratioText} 未達。次回へ継続` : 'DoneCriteria未達。次回へ継続'
  return ratioText ?? `DoneCriteria ${status}`
}

function changedFilesLabel(r: ExecutionRun): string {
  const count = r.changedFiles?.filter((f) => f.file.trim()).length ?? 0
  if (count === 0) return '変更なし（成果物の変化なし・空振り/作業済み判定）'
  return `変更ファイル ${count}件`
}

function runSummary(r: ExecutionRun): string {
  return shorten(humanizeTitle(r.summary || r.targetTodoTitle || '要約なし'), 58)
}

function barColor(pct: number): string {
  if (pct >= 70) return 'bg-emerald-500'
  if (pct >= 35) return 'bg-amber-500'
  return 'bg-rose-400'
}

function getGoalTitle(goalById: Map<string, Goal>, goalId?: string, fallback?: string): string {
  if (goalId && goalById.has(goalId)) return goalById.get(goalId)!.title
  return fallback || 'ゴール未設定'
}

function countBy<T>(items: T[], keyOf: (item: T) => string): Array<{ key: string; count: number }> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

function repeatedEpicRows(runs: ExecutionRun[]): RepeatedEpicRow[] {
  const map = new Map<string, ExecutionRun[]>()
  for (const run of runs) {
    if (!run.epicId) continue
    const group = map.get(run.epicId) ?? []
    group.push(run)
    map.set(run.epicId, group)
  }
  return Array.from(map.entries())
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => runTime(b) - runTime(a))
      return {
        key,
        runs: sorted,
        count: sorted.length,
        completed: sorted.filter((r) => r.runStatus === 'completed').length,
        partial: sorted.filter((r) => r.runStatus === 'partial').length,
        failed: sorted.filter((r) => r.runStatus === 'failed').length,
        running: sorted.filter((r) => r.runStatus === 'running').length,
      }
    })
    .filter((row) => row.count >= 2)
    .sort((a, b) => b.count - a.count || (b.runs[0]?.startedAt ?? '').localeCompare(a.runs[0]?.startedAt ?? '') || a.key.localeCompare(b.key))
    .slice(0, 6)
}

export default async function ActivityPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const rawPeriod = typeof searchParams?.period === 'string' ? searchParams.period : ''
  const period: PeriodKey = rawPeriod === 'day' || rawPeriod === 'month' ? rawPeriod : 'week'
  const range = periodRange(period)

  const [runs, goalsData, epics] = await Promise.all([readExecutionRuns(), readGoals(), getEpics()])
  const goalById = new Map(goalsData.goals.map((g) => [g.id, g]))
  const epicById = new Map(epics.map((e) => [e.epicId, e]))
  const autoRuns = runs.filter(isAutoRun)
  const periodRuns = autoRuns
    .filter((r) => {
      const t = runTime(r)
      return t >= range.start.getTime() && t < range.end.getTime()
    })
    .sort((a, b) => runTime(b) - runTime(a))

  const completedRuns = periodRuns.filter((r) => r.runStatus === 'completed')
  const totalDuration = periodRuns.reduce((sum, r) => sum + durationMs(r), 0)
  const doneGoals = goalsData.goals
    .filter((g) => g.status === 'done' && inRange(g.updatedAt, range.start, range.end))
    .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt))
  const activeGoals = goalsData.goals
    .filter((g) => g.status === 'active')
    .map((goal) => ({ goal, achievement: goalAchievement(goal) }))
    .sort((a, b) => a.achievement - b.achievement)
    .slice(0, 5)

  const repeatedEpics = repeatedEpicRows(periodRuns)

  const projectRows = countBy(periodRuns, (r) => appLabel(r.targetApp))
    .map((row) => ({
      ...row,
      completed: periodRuns.filter((r) => appLabel(r.targetApp) === row.key && r.runStatus === 'completed').length,
    }))
    .slice(0, 6)

  const stats = [
    { label: '実行', value: periodRuns.length, cls: 'text-gray-950 dark:text-white' },
    { label: '完了', value: completedRuns.length, cls: 'text-emerald-700 dark:text-emerald-300' },
    { label: '一部', value: periodRuns.filter((r) => r.runStatus === 'partial').length, cls: 'text-amber-700 dark:text-amber-300' },
    { label: '失敗', value: periodRuns.filter((r) => r.runStatus === 'failed').length, cls: 'text-rose-700 dark:text-rose-300' },
  ]

  return (
    <div className="space-y-3 px-3 pb-5 pt-4 sm:px-4">
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-gray-950 dark:text-white">自動実行状況</h1>
            <p className="mt-0.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">{range.label}の消化サマリー</p>
          </div>
          <Link href="/report" className="shrink-0 text-[12px] font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
            詳細ログを見る →
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg bg-gray-100 p-1 dark:bg-gray-950/60">
          {periodOptions.map((opt) => (
            <Link
              key={opt.key}
              href={`/activity?period=${opt.key}`}
              className={`rounded-md px-3 py-1.5 text-center text-sm font-black transition-colors ${
                period === opt.key
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-gray-800 dark:text-blue-300'
                  : 'text-gray-500 hover:bg-white/60 dark:text-gray-400 dark:hover:bg-gray-800/60'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">消化サマリー</h2>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className={subtleCard}>
              <p className="text-[10px] font-bold text-gray-400">{s.label}</p>
              <p className={`mt-0.5 text-xl font-black ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-1.5 rounded-lg bg-gray-50 px-3 py-2 text-[12px] font-bold text-gray-700 dark:bg-gray-950/35 dark:text-gray-200">
          所要合計 <span className="text-base font-black">{fmtDuration(totalDuration)}</span>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">何を消化したか</h2>
          <span className="text-[11px] font-bold text-gray-400">完了 {completedRuns.length}件</span>
        </div>
        {completedRuns.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">この期間の完了Runはありません。</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {completedRuns.slice(0, 8).map((r) => {
              const epic = r.epicId ? epicById.get(r.epicId) : undefined
              const goalTitle = getGoalTitle(goalById, epic?.goalId ?? r.selection?.selectedGoalKey, r.selection?.selectedGoalTitle ?? epic?.goal)
              return (
                <li key={r.runId} className="rounded-lg bg-gray-50 p-2 dark:bg-gray-950/35">
                  <p className="line-clamp-2 text-[13px] font-bold leading-snug text-gray-900 dark:text-gray-100">{displayTitle(r)}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    {appLabel(r.targetApp)} / {shorten(humanizeTitle(goalTitle), 24)}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
        {completedRuns.length > 8 && (
          <Link href="/report" className="mt-2 inline-block text-[12px] font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
            もっと見る →
          </Link>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">再実行に回ったゴール/Epic</h2>
        {repeatedEpics.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">同じEpicの再実行はありません。</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {repeatedEpics.map((row) => {
              const epic = epicById.get(row.key)
              const heavy = row.count >= 5
              const goalTitle = getGoalTitle(goalById, epic?.goalId, epic?.goal)
              const title = humanizeTitle(epic?.title ?? goalTitle ?? row.key)
              const breakdown = [
                row.completed > 0 ? `完了${row.completed}` : '',
                row.partial > 0 ? `一部${row.partial}` : '',
                row.failed > 0 ? `失敗${row.failed}` : '',
                row.running > 0 ? `実行中${row.running}` : '',
              ].filter(Boolean).join(' / ')
              return (
                <li key={row.key}>
                  <details
                    className={`group rounded-lg ${
                    heavy
                      ? 'bg-amber-50 text-amber-950 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:ring-amber-900/70'
                      : 'bg-gray-50 text-gray-900 dark:bg-gray-950/35 dark:text-gray-100'
                  }`}
                  >
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-2 px-2.5 py-2 marker:hidden">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[13px] font-black leading-snug">
                          {shorten(title, 34)} — {row.count}回実行
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                          {breakdown || '結果未記録'}{goalTitle ? ` / ${shorten(humanizeTitle(goalTitle), 22)}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-black ${heavy ? 'bg-amber-200 text-amber-950 dark:bg-amber-900/70 dark:text-amber-50' : 'bg-white text-gray-700 dark:bg-gray-800 dark:text-gray-100'}`}>
                        <span className="group-open:hidden">開く</span>
                        <span className="hidden group-open:inline">閉じる</span>
                      </span>
                    </summary>
                    <ol className="space-y-1.5 px-2.5 pb-2">
                      {row.runs.map((run) => {
                        const note = doneCriteriaNote(run)
                        return (
                          <li key={run.runId} className="rounded-md border border-white/70 bg-white/75 p-2 dark:border-gray-800 dark:bg-gray-900/75">
                            <div className="flex items-center justify-between gap-2">
                              <time className="min-w-0 truncate text-[11px] font-bold text-gray-500 dark:text-gray-400">
                                {runPeriodLabel(run)}
                              </time>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${statusBadgeClass(run.runStatus)}`}>
                                {statusLabel(run.runStatus)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-snug text-gray-900 dark:text-gray-100">
                              {runSummary(run)}
                            </p>
                            <p className="mt-1 text-[11px] font-semibold leading-snug text-gray-600 dark:text-gray-300">
                              {humanStopReason(run.stopReason)}
                              {note ? <span className="text-gray-500 dark:text-gray-400"> / {note}</span> : null}
                            </p>
                            <p className={`mt-0.5 text-[11px] font-bold ${run.changedFiles.length === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>
                              {changedFilesLabel(run)}
                            </p>
                            {run.selection?.selectedReason ? (
                              <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-snug text-gray-400 dark:text-gray-500">
                                選ばれた理由: {shorten(humanizeTitle(run.selection.selectedReason), 54)}
                              </p>
                            ) : null}
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-mono text-[10px] text-gray-400 dark:text-gray-500">{run.runId}</span>
                              <Link href={`/report?q=${encodeURIComponent(run.runId)}`} className="shrink-0 text-[11px] font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
                                詳細
                              </Link>
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">達成したゴール</h2>
        {doneGoals.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">なし</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-1.5">
            {doneGoals.slice(0, 6).map((g) => (
              <li key={g.id} className="rounded-lg bg-emerald-50 px-2.5 py-2 text-[13px] font-bold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                {shorten(humanizeTitle(g.title), 34)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">プロジェクト別</h2>
        {projectRows.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">この期間の実行はありません。</p>
        ) : (
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {projectRows.map((row) => (
              <div key={row.key} className={subtleCard}>
                <p className="truncate text-[12px] font-black text-gray-900 dark:text-gray-100">{row.key}</p>
                <p className="mt-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
                  実行 {row.count} / 完了 {row.completed}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-gray-900 dark:text-gray-100">全体進行状況</h2>
          <Link href="/goal-dashboard" className="shrink-0 text-[12px] font-bold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
            ゴールを見る →
          </Link>
        </div>
        {activeGoals.length === 0 ? (
          <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">進行中のゴールはありません。</p>
        ) : (
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {activeGoals.map(({ goal, achievement }) => (
              <li key={goal.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[13px] font-bold text-gray-900 dark:text-gray-100">{shorten(humanizeTitle(goal.title), 30)}</p>
                  <span className="shrink-0 text-[12px] font-black text-gray-700 dark:text-gray-200">{achievement}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${barColor(achievement)}`} style={{ width: `${Math.max(2, achievement)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pb-2 text-center">
        <Link href="/report" className="text-[12px] font-bold text-gray-500 underline-offset-2 hover:underline dark:text-gray-400">
          1実行ごとの詳細ログを見る →
        </Link>
      </section>
    </div>
  )
}
