export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress, readProjectTasks, readWorkLog } from '@/lib/progress-reader'
import { calcDashboardStats, sortByAttention } from '@/lib/progress-transform'
import { buildFactoryDashboard } from '@/lib/factory-dashboard'
import { computeFactoryMetrics } from '@/lib/factory-metrics'
import { buildQueueSplit } from '@/lib/queue-split'
import { epicPriorityLabel } from '@/lib/epic-priority-label'
import StatsBar from '@/components/dashboard/StatsBar'
import ProjectCards from '@/components/dashboard/ProjectCards'
import RecentLogs from '@/components/dashboard/RecentLogs'
import AiReviewPanel from '@/components/dashboard/AiReviewPanel'
import { CopyPacketButton, EpicDecisionControls, GoalQuickForm, ReviewControls } from '@/components/dashboard/FactoryActions'

function pct(n: number): string {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`
}

function fmt(dt?: string): string {
  if (!dt) return ''
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusClass(status: string): string {
  if (status === 'active' || status === 'approved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (status === 'proposed' || status === 'in_review') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (status === 'done' || status === 'merged') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (status === 'dropped') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
}

export default async function DashboardPage() {
  const [progressData, logs, tasksData, factory, metrics, queues] = await Promise.all([
    readAppProgress(),
    readWorkLog(10),
    readProjectTasks(),
    buildFactoryDashboard(),
    computeFactoryMetrics(),
    buildQueueSplit(),
  ])

  const stats = calcDashboardStats(progressData.projects)
  const sorted = sortByAttention(progressData.projects)
  const taskCounts: Record<string, number> = {}
  for (const pt of tasksData.projects) taskCounts[pt.projectId] = pt.tasks.length
  const humanTodos = tasksData.projects
    .flatMap((p) => p.tasks.map((t) => ({ ...t, projectId: p.projectId })))
    .filter((t) => t.assignee === 'user' && !['done', 'skipped', 'deleted'].includes(t.status))
    .slice(0, 6)

  const todayLabel = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="space-y-6 px-4 pb-6 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Progress Command</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500">{todayLabel}</p>
      </header>

      {factory.goals.length === 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">Goal未設定</h2>
          <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            Goal層が空です。下のGoal管理でNorth Star / mainGoalを作成すると、Epicの優先順位と次作業候補が安定します。
          </p>
        </section>
      )}

      {metrics.backpressure.level !== 'ok' && (
        <section className={`rounded-xl border p-4 ${metrics.backpressure.level === 'pause' ? 'border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20' : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20'}`}>
          <h2 className={`text-sm font-bold ${metrics.backpressure.level === 'pause' ? 'text-rose-800 dark:text-rose-200' : 'text-amber-800 dark:text-amber-200'}`}>
            Factory バックプレッシャー警告
          </h2>
          <p className={`mt-1 text-xs leading-relaxed ${metrics.backpressure.level === 'pause' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {metrics.backpressure.message}。factoryEnabled は変更されません（自動恒久OFFなし）。下のAI一次レビューで滞留を解消してください。
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Factory Metrics</h2>
          <span className="text-[11px] text-gray-400">{fmt(metrics.computedAt)} 時点</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">closed_loop_rate</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{(metrics.closedLoopRate * 100).toFixed(1)}%</p>
            <p className="text-[11px] text-gray-400">Knowledge {metrics.knowledgeCount} / Run {metrics.totalRuns}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">not_reviewed_count</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.notReviewedCount}</p>
            <p className="text-[11px] text-gray-400">needs_human {metrics.needsHumanCount} · followup {metrics.needsFollowupCount}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">oldest_not_reviewed_age</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.oldestNotReviewedAgeDays ?? '-'}{metrics.oldestNotReviewedAgeDays !== null && <span className="text-xs font-normal">日</span>}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">daily_decision_count</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.dailyDecisionCount}</p>
            <p className="text-[11px] text-gray-400">承認待ち {metrics.pendingApprovalCount}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">suggested_epic_count</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{metrics.suggestedEpicCount}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">stale_suggested_count</p>
            <p className={`mt-0.5 text-lg font-bold ${metrics.staleSuggestedCount > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100'}`}>{metrics.staleSuggestedCount}</p>
            <p className="text-[11px] text-gray-400">7日以上 suggested のまま</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">factory_last_result</p>
            <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-gray-900 dark:text-gray-100">{metrics.factoryLastResult ?? 'なし'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            <p className="text-[11px] text-gray-400">factory_last_error</p>
            <p className={`mt-0.5 line-clamp-2 text-xs font-semibold ${metrics.factoryLastError ? 'text-rose-600' : 'text-gray-900 dark:text-gray-100'}`}>{metrics.factoryLastError ?? 'なし'}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">Human Queue（人間判断）</h2>
          <p className="mb-3 text-xs text-gray-400">公開 / 課金 / 認証 / 本番DB / Goal判断 / 上位候補承認 / needs_human Run</p>
          <ul className="space-y-2">
            {queues.human.slice(0, 10).map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-rose-500">{item.kind}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{item.detail}</p>
                  </div>
                  {item.href && (
                    <Link href={item.href} className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">開く</Link>
                  )}
                </div>
              </li>
            ))}
            {queues.human.length === 0 && <li className="text-sm text-gray-400">人間判断待ちはありません。</li>}
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">AI Queue（AI自走）</h2>
          <p className="mb-3 text-xs text-gray-400">run一次レビュー / candidate scoring / orphan修復提案 / failed・partial原因分析 / next epic draft</p>
          <ul className="space-y-2">
            {queues.ai.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-blue-500">{item.kind}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{item.detail}</p>
                  </div>
                  {item.href && (
                    <Link href={item.href} className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">開く</Link>
                  )}
                </div>
              </li>
            ))}
            {queues.ai.length === 0 && <li className="text-sm text-gray-400">AI自走候補はありません。</li>}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">今日の意思決定キュー</h2>
              <p className="text-xs text-gray-400">承認、却下、Goal紐付け、優先度変更をここで処理します</p>
            </div>
            <Link href="/approvals" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">承認箱</Link>
          </div>
          {factory.decisionQueue.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800/50">今日の意思決定はありません。</p>
          ) : (
            <ul className="space-y-3">
              {factory.decisionQueue.map((item) => (
                <li key={item.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{item.description}</p>
                      {item.epic && (
                        <p className="mt-1 text-[11px] text-gray-400">{item.epic.epicId} · {epicPriorityLabel(item.epic.priority)} · {item.epic.status}</p>
                      )}
                      {item.run && (
                        <p className="mt-1 text-[11px] text-gray-400">{item.run.runId} · {item.run.targetApp} · {item.run.reviewStatus}</p>
                      )}
                    </div>
                    {item.epic && (
                      <Link href={`/epic/${item.epic.epicId}`} className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">詳細</Link>
                    )}
                  </div>
                  {item.epic && ['approval_waiting', 'orphan_epic'].includes(item.type) && (
                    <EpicDecisionControls epicId={item.epic.epicId} goals={factory.goals} currentGoalId={item.epic.goalId} currentPriority={item.epic.priority} />
                  )}
                  {item.epic && item.type !== 'approval_waiting' && item.type !== 'orphan_epic' && (
                    <div className="mt-3">
                      <EpicDecisionControls epicId={item.epic.epicId} goals={factory.goals} currentGoalId={item.epic.goalId} currentPriority={item.epic.priority} />
                    </div>
                  )}
                  {item.run && <ReviewControls runId={item.run.runId} />}
                  {item.type === 'wip_over' && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                      保存は止めません。active Epicを完了、pause、splitしてWIPを絞ってください。
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Goal管理</h2>
            <GoalQuickForm goals={factory.goals} />
          </section>
          <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">North Star Goal</h2>
            {factory.northStarGoal ? (
              <div className="mt-3">
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{factory.northStarGoal.title}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{factory.northStarGoal.description || factory.northStarGoal.summary}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-gray-500">
                    <span>{factory.northStarGoal.metric ?? 'progress'}</span>
                    <span>{factory.northStarGoal.current ?? 0} / {factory.northStarGoal.target ?? 100}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: pct(((factory.northStarGoal.current ?? 0) / (factory.northStarGoal.target || 100)) * 100) }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-400">North Star未設定</p>
            )}
          </section>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Goal別進捗</h2>
        {factory.goalCards.length === 0 ? (
          <p className="text-sm text-gray-400">Goalがありません。</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {factory.goalCards.map((card) => (
              <div key={card.goal.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{card.goal.title}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{card.epics.length} Epic · active {card.activeEpics.length}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{card.achievement}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: pct(card.achievement) }} />
                </div>
                <ul className="mt-3 space-y-1">
                  {card.epics.slice(0, 4).map((epic) => (
                    <li key={epic.epicId} className="flex items-center justify-between gap-2 text-xs">
                      <Link href={`/epic/${epic.epicId}`} className="truncate text-gray-700 hover:underline dark:text-gray-200">{epic.title}</Link>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${statusClass(epic.status)}`}>{epic.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">進行中Epic</h2>
          <ul className="space-y-2">
            {factory.activeEpics.slice(0, 8).map((epic) => (
              <li key={epic.epicId} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <Link href={`/epic/${epic.epicId}`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">{epic.title}</Link>
                <p className="mt-1 text-xs text-gray-400">{epic.goalId ? factory.goals.find((g) => g.id === epic.goalId)?.title ?? epic.goalId : 'Goal未紐付き'} · {epicPriorityLabel(epic.priority)}</p>
              </li>
            ))}
            {factory.activeEpics.length === 0 && <li className="text-sm text-gray-400">active Epicはありません。</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Goal未紐付きEpic</h2>
          <ul className="space-y-3">
            {factory.orphanEpics.slice(0, 6).map((epic) => (
              <li key={epic.epicId} className="rounded-lg border border-amber-100 p-3 dark:border-amber-900/40">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{epic.title}</p>
                <EpicDecisionControls epicId={epic.epicId} goals={factory.goals} currentPriority={epic.priority} />
              </li>
            ))}
            {factory.orphanEpics.length === 0 && <li className="text-sm text-gray-400">未紐付きEpicはありません。</li>}
          </ul>
        </div>
      </section>

      {factory.wipWarnings.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
          <h2 className="text-sm font-bold text-amber-800 dark:text-amber-200">WIP警告</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
            {factory.wipWarnings.map((w, i) => (
              <li key={i}>{w.scope === 'global' ? '全体' : w.goalTitle}: active {w.activeCount}/{w.limit}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">blocker一覧</h2>
          <ul className="space-y-2">
            {factory.blockerEpics.map((epic) => (
              <li key={epic.epicId} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800/50">
                <Link href={`/epic/${epic.epicId}`} className="font-medium text-gray-900 hover:underline dark:text-gray-100">{epic.title}</Link>
                <p className="mt-1 text-xs text-gray-500">{epic.blockers?.join(' / ') || 'status=blocked'}</p>
              </li>
            ))}
            {factory.blockerEpics.length === 0 && <li className="text-sm text-gray-400">blockerはありません。</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">次にAIが着手予定のEpic</h2>
          {factory.nextAiEpic ? (
            <div>
              <Link href={`/epic/${factory.nextAiEpic.epicId}`} className="text-base font-semibold text-gray-900 hover:underline dark:text-gray-100">{factory.nextAiEpic.title}</Link>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{factory.nextAiEpic.nextAction || factory.nextAiEpic.goal}</p>
              <p className="mt-2 text-xs text-gray-400">{epicPriorityLabel(factory.nextAiEpic.priority)} · {factory.nextAiEpic.targetApp ?? factory.nextAiEpic.targetApps?.[0] ?? 'targetApp未設定'}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">着手候補がありません。Goal紐付けとapproveを行ってください。</p>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">直近Execution Run</h2>
          <ul className="space-y-2">
            {factory.recentRuns.map((run) => (
              <li key={`${run.runId}-${run.startedAt}`} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{run.summary || run.targetTodoTitle}</p>
                <p className="mt-1 text-xs text-gray-400">{run.runId} · {run.targetApp} · {run.runStatus} · {run.reviewStatus} · {fmt(run.finishedAt)}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">人間専用TODO</h2>
          <ul className="space-y-2">
            {humanTodos.map((todo) => (
              <li key={todo.id} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{todo.title}</p>
                <p className="mt-1 text-xs text-gray-400">{todo.projectId} · {todo.priority} · {todo.status}</p>
              </li>
            ))}
            {humanTodos.length === 0 && <li className="text-sm text-gray-400">人間TODOはありません。</li>}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Resume Packet</h2>
        <div className="space-y-3">
          {factory.resumePackets.map((packet) => (
            <div key={packet.epicId} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{packet.epicTitle}</p>
                  <p className="text-xs text-gray-400">{packet.goalTitle} · {packet.status} · {fmt(packet.updatedAt)}</p>
                </div>
                <CopyPacketButton text={packet.text} />
              </div>
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-3 text-xs leading-relaxed text-gray-100">{packet.text}</pre>
            </div>
          ))}
          {factory.resumePackets.length === 0 && <p className="text-sm text-gray-400">再開対象のEpicはありません。</p>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">Review Queue</h2>
        <div className="mb-3">
          <AiReviewPanel notReviewedCount={metrics.notReviewedCount} oldestAgeDays={metrics.oldestNotReviewedAgeDays} />
        </div>
        <ul className="space-y-3">
          {factory.reviewRuns.slice(0, 8).map((run) => (
            <li key={`${run.runId}-${run.startedAt}`} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <p className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-100">{run.summary || run.targetTodoTitle}</p>
              <p className="mt-1 text-xs text-gray-400">{run.runId} · {run.targetApp} · {run.reviewStatus}</p>
              <ReviewControls runId={run.runId} />
            </li>
          ))}
          {factory.reviewRuns.length === 0 && <li className="text-sm text-gray-400">review待ちはありません。</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">レビューから生成された次Epic候補</h2>
            <p className="text-xs text-gray-400">reviewed ExecutionRun → Knowledge → recommended-epics</p>
          </div>
          <Link href="/recommended-epics" className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">おすすめEpic</Link>
        </div>
        {factory.reviewGeneratedRecommendations.length === 0 ? (
          <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-500 dark:bg-gray-800/50">
            まだレビュー起点の次Epic候補はありません。Review QueueでmarkReviewedすると自動生成されます。
          </p>
        ) : (
          <ul className="space-y-3">
            {factory.reviewGeneratedRecommendations.slice(0, 6).map((rec) => (
              <li key={rec.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-gray-400">{rec.goalId ?? 'goal未設定'} · 優先度{epicPriorityLabel(rec.priority)}</p>
                    <Link href={`/recommended-epics/${rec.id}`} className="mt-0.5 block line-clamp-2 text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">
                      {rec.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{rec.reason}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      parent: {rec.parentEpicId ?? rec.relatedEpicId ?? 'なし'} · run: {rec.sourceRunId ?? rec.relatedRunIds?.[0] ?? 'なし'} · knowledge: {rec.sourceKnowledgeId ?? rec.sourceRef ?? 'なし'}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {rec.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatsBar data={stats} />
      <ProjectCards projects={sorted} taskCounts={taskCounts} title="既存案件一覧" />
      <RecentLogs logs={logs} />
    </div>
  )
}
