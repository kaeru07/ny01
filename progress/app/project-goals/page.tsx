export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readGoals, goalAchievement } from '@/lib/goal-reader'
import { readAppProgress } from '@/lib/progress-reader'
import { epicPriorityLabel } from '@/lib/epic-priority-label'
import type { Goal } from '@/types/goal'

// プロジェクト×ゴール 進捗一覧。
// 「どのプロジェクトの、どのゴールに向けて、どれだけ進んでいるか」をユーザー目線で1画面に。
// アプリは App Store 公開仕様まで行けたら「完成」をプロジェクトに表示する。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const PRIORITY_NUM: Record<string, number> = { high: 0, medium: 1, low: 2 }

const GOAL_STATUS_LABEL: Record<string, string> = {
  active: '実行中', proposed: '承認待ち', paused: '後で', done: '完了', dropped: '取りやめ', archived: '保管',
}
const GOAL_STATUS_CLS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  done: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  proposed: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  paused: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

function bar(pct: number): string {
  const p = Math.max(0, Math.min(100, pct))
  if (p >= 100) return 'bg-blue-500'
  if (p >= 60) return 'bg-green-500'
  if (p >= 30) return 'bg-amber-500'
  return 'bg-rose-400'
}

// App Store 公開仕様まで到達＝「完成」とみなすヒューリスティック（明示フラグが無いため status/進捗から推定）。
function completion(status: string, progress: number, nextAction: string): { label: string; cls: string } | null {
  const s = (status || '').toLowerCase()
  const na = nextAction || ''
  if (/(published|released|完成)/.test(s)) return { label: '🎉 公開済み', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' }
  if (s === 'deploy_ready' || (s === 'user_action_pending' && /App\s*Store|TestFlight|提出|公開/i.test(na)) || progress >= 100) {
    return { label: '✅ 公開仕様（完成扱い）', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
  }
  return null
}

export default async function ProjectGoalsPage() {
  const [goalsData, appProgress] = await Promise.all([readGoals(), readAppProgress()])
  const projects = (Array.isArray(appProgress.projects) ? appProgress.projects : []) as Array<{
    id: string; name?: string; status?: string; progress?: number; currentTask?: string; nextAction?: string; url?: string
  }>
  // 取りやめ/保管は一覧から除外（現在進行に集中）。
  const liveGoals = goalsData.goals.filter((g) => g.status !== 'dropped' && g.status !== 'archived')
  const byProject = new Map<string, Goal[]>()
  for (const g of liveGoals) {
    const pid = (g.projectId && String(g.projectId).trim()) || '__unlinked__'
    if (!byProject.has(pid)) byProject.set(pid, [])
    byProject.get(pid)!.push(g)
  }
  const sortGoals = (gs: Goal[]) =>
    [...gs].sort((a, b) => (PRIORITY_NUM[a.priority] ?? 1) - (PRIORITY_NUM[b.priority] ?? 1) || goalAchievement(a) - goalAchievement(b))

  // 表示順: ゴールを持つプロジェクトを優先度高ゴール数→進捗で。未紐付けは最後に警告として。
  const projRows = projects
    .map((p) => ({ p, goals: byProject.get(p.id) ?? [] }))
    .filter((r) => r.goals.length > 0)
    .sort((a, b) => {
      const ah = a.goals.filter((g) => g.priority === 'high' && g.status === 'active').length
      const bh = b.goals.filter((g) => g.priority === 'high' && g.status === 'active').length
      return bh - ah || (b.p.progress ?? 0) - (a.p.progress ?? 0)
    })
  const unlinked = byProject.get('__unlinked__') ?? []
  const activeTotal = liveGoals.filter((g) => g.status === 'active').length

  return (
    <div className="space-y-4 px-4 pb-6 pt-6">
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h1 className="text-lg font-black text-gray-950 dark:text-white">プロジェクト × ゴール 進捗一覧</h1>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          どのプロジェクトの、どのゴールに向けて、どれだけ進んでいるかを1画面で。優先度「高」のゴールがあるプロジェクトが上に出ます。アプリは App Store 公開仕様まで行けたら「完成」を表示します。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">実行中ゴール {activeTotal}</span>
          <span className="rounded-lg bg-gray-100 px-2.5 py-1 font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">ゴールのあるPJ {projRows.length}</span>
          {unlinked.length > 0 && <span className="rounded-lg bg-rose-100 px-2.5 py-1 font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">未紐付けゴール {unlinked.length}</span>}
          <Link href="/goal-dashboard" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">達成率ダッシュボード →</Link>
        </div>
      </section>

      {unlinked.length > 0 && (
        <section className={`${card} border border-rose-200 dark:border-rose-900/40`}>
          <h2 className="text-sm font-bold text-rose-700 dark:text-rose-300">⚠️ プロジェクト未紐付けのゴール（{unlinked.length}）</h2>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">運用方針では全ゴールがプロジェクトに紐づきます。下記は紐付け待ちです。</p>
          <ul className="mt-2 space-y-1">
            {sortGoals(unlinked).map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate text-gray-800 dark:text-gray-100">{g.title}</span>
                <span className="shrink-0 text-[10px] text-gray-400">{GOAL_STATUS_LABEL[g.status] ?? g.status}・優先度{epicPriorityLabel(g.priority === 'high' ? 'P0' : g.priority === 'low' ? 'P2' : 'P1')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projRows.map(({ p, goals }) => {
        const done = completion(p.status ?? '', p.progress ?? 0, p.nextAction ?? '')
        return (
          <section key={p.id} className={card}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{p.name || p.id}</h2>
                <p className="mt-0.5 text-[11px] text-gray-400">進捗 {p.progress ?? 0}% ・ {p.status ?? '—'}{p.currentTask ? ` ・ ${p.currentTask.slice(0, 40)}` : ''}</p>
              </div>
              {done && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${done.cls}`}>{done.label}</span>}
            </div>
            <ul className="mt-3 space-y-2">
              {sortGoals(goals).map((g) => {
                const ach = goalAchievement(g)
                return (
                  <li key={g.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[12px] font-semibold text-gray-800 dark:text-gray-100">{g.title}</span>
                        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${GOAL_STATUS_CLS[g.status] ?? 'bg-gray-100 text-gray-500'}`}>{GOAL_STATUS_LABEL[g.status] ?? g.status}</span>
                      </span>
                      <span className="shrink-0 text-[10px] font-bold text-gray-400">優先度{epicPriorityLabel(g.priority === 'high' ? 'P0' : g.priority === 'low' ? 'P2' : 'P1')} ・ {ach}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className={`h-full rounded-full ${bar(ach)}`} style={{ width: `${Math.max(2, Math.min(100, ach))}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {projRows.length === 0 && unlinked.length === 0 && (
        <p className={`${card} text-[12px] text-gray-500 dark:text-gray-400`}>表示するゴールがありません。</p>
      )}
    </div>
  )
}
