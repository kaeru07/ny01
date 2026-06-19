import Link from 'next/link'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals } from '@/lib/goal-reader'
import { getAutomationLog, getAutomationConfig } from '@/lib/operations-store'
import type { ExecutionRun } from '@/types/execution-run'

// 運用ページ「自動実行レポート」タブの中身（自動実行内容の報告）。
// AI工場が自動で何をしたか・次に何をするかを人間がひと目で把握できるようにする server コンポーネント。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const h2 = 'text-sm font-bold text-gray-900 dark:text-gray-100'

const SCHEDULE = ['11:00', '14:00', '16:00', '23:00']

function isAutoRun(r: ExecutionRun): boolean {
  return r.factoryRun === true || (typeof r.source === 'string' && /factory|schedule|boot/.test(r.source))
}

function fmt(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  completed: '完了',
  partial: '一部完了',
  failed: '失敗',
  running: '実行中',
}
const STATUS_TONE: Record<string, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  partial: 'text-amber-600 dark:text-amber-400',
  failed: 'text-red-600 dark:text-red-400',
  running: 'text-blue-600 dark:text-blue-400',
}

const EVENT_LABEL: Record<string, string> = {
  factory_goal_proposal_requested: 'ゴール候補を提案',
  factory_goal_step_epic_created: '次の一歩を自動作成',
  factory_dispatch: '作業を自動実行',
  factory_backpressure: '自動実行を一時停止',
  ai_review: 'AIレビュー',
  auto_fallback: '実行者フォールバック',
  auto_resume: '自動再開',
  claude_limit_detection: '上限検知',
}

export default async function AutoExecReport() {
  const [runs, goalsData, log, config] = await Promise.all([
    readExecutionRuns(),
    readGoals(),
    getAutomationLog(40),
    getAutomationConfig().catch(() => null),
  ])

  const autoRuns = runs
    .filter(isAutoRun)
    .sort((a, b) => (b.finishedAt || b.startedAt || '').localeCompare(a.finishedAt || a.startedAt || ''))
  const recent = autoRuns.slice(0, 12)
  const counts = autoRuns.reduce(
    (acc, r) => {
      acc[r.runStatus] = (acc[r.runStatus] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const proposedCount = goalsData.goals.filter((g) => g.status === 'proposed').length
  const activeCount = goalsData.goals.filter((g) => g.status === 'active').length
  const factoryOn = config?.factoryEnabled !== false
  const relevantLog = log
    .filter((e) => EVENT_LABEL[e.event])
    .slice(0, 10)

  return (
    <div className="space-y-4">
      {/* 状態・次回予定 */}
      <section className={card}>
        <h2 className={h2}>AI工場の状態と次回予定</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${factoryOn ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            {factoryOn ? '稼働中（自動実行ON）' : '停止中（自動実行OFF）'}
          </span>
          <span className="text-gray-500 dark:text-gray-400">毎日の自動実行: {SCHEDULE.join(' / ')}（JST）</span>
        </div>
        <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
          自動実行のたびに、調査結果から新しいゴール候補を提案し、承認済みゴールを優先順に進めます。
        </p>
      </section>

      {/* サマリー */}
      <section className={card}>
        <h2 className={h2}>これまでの自動実行サマリー</h2>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Stat label="完了" value={counts.completed ?? 0} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="一部完了" value={counts.partial ?? 0} tone="text-amber-600 dark:text-amber-400" />
          <Stat label="失敗" value={counts.failed ?? 0} tone="text-red-600 dark:text-red-400" />
          <Stat label="自動実行 計" value={autoRuns.length} tone="text-gray-700 dark:text-gray-200" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Link href="/decide?tab=goalApproval" className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/15 dark:text-blue-300">
            承認待ちのゴール候補 {proposedCount}件 →
          </Link>
          <Link href="/goal-planner" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">
            進行中の目標 {activeCount}件
          </Link>
        </div>
      </section>

      {/* 直近の自動実行 */}
      <section className={card}>
        <h2 className={h2}>直近の自動実行（{recent.length}件）</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">まだ自動実行の記録がありません。次回の定時実行で記録されます。</p>
        ) : (
          <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {recent.map((r) => (
              <li key={r.runId} className="py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-xs font-medium text-gray-800 dark:text-gray-100">{r.targetTodoTitle || r.summary || '(無題)'}</span>
                  <span className={`shrink-0 text-[11px] font-semibold ${STATUS_TONE[r.runStatus] ?? 'text-gray-500'}`}>{STATUS_LABEL[r.runStatus] ?? r.runStatus}</span>
                </div>
                {r.summary && <p className="mt-0.5 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">{r.summary}</p>}
                <p className="mt-0.5 text-[10px] text-gray-400">{fmt(r.finishedAt || r.startedAt)}</p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <Link href="/logs" className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">すべての実行履歴を見る →</Link>
        </div>
      </section>

      {/* 自動化ログ（何をしたか） */}
      <section className={card}>
        <h2 className={h2}>自動化の動き（最近）</h2>
        {relevantLog.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">記録がありません。</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {relevantLog.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="min-w-0 text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">{EVENT_LABEL[e.event]}</span>
                  {e.fallbackReason && <span className="text-gray-500 dark:text-gray-400">：{e.fallbackReason.split('\n')[0].slice(0, 60)}</span>}
                </span>
                <span className="shrink-0 text-gray-400">{fmt(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/50">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
