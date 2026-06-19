import Link from 'next/link'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals } from '@/lib/goal-reader'
import { getAutomationLog, getAutomationConfig } from '@/lib/operations-store'
import type { ExecutionRun } from '@/types/execution-run'

// 運用ページ「自動実行レポート」タブの中身。
// AI工場が自動で何をしたかを「記事」のように1ページで詳細に残す（日次タイムライン＋各実行の詳細）。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const h2 = 'text-base font-bold text-gray-900 dark:text-gray-100'
const h3 = 'text-sm font-bold text-gray-900 dark:text-gray-100'

const SCHEDULE = ['11:00', '14:00', '16:00', '23:00']

function isAutoRun(r: ExecutionRun): boolean {
  return r.factoryRun === true || (typeof r.source === 'string' && /factory|schedule|boot/.test(r.source))
}

function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function dateKey(iso?: string): string {
  if (!iso) return '不明'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '不明'
  return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

const STATUS_LABEL: Record<string, string> = { completed: '完了', partial: '一部完了', failed: '失敗', running: '実行中' }
const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  running: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
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

const CHECK_LABEL: Record<string, string> = {
  build: 'build',
  typescript: 'tsc',
  lint: 'lint',
  manual: '手動確認',
  mainScreen: '主要画面',
  mobileLayout: 'モバイル',
  mainScreens: '主要画面',
  iphone: 'iPhone',
}

export default async function AutoExecReport() {
  const [runs, goalsData, log, config] = await Promise.all([
    readExecutionRuns(),
    readGoals(),
    getAutomationLog(60),
    getAutomationConfig().catch(() => null),
  ])

  const autoRuns = runs
    .filter(isAutoRun)
    .sort((a, b) => (b.finishedAt || b.startedAt || '').localeCompare(a.finishedAt || a.startedAt || ''))
  const detailed = autoRuns.slice(0, 40)

  const counts = autoRuns.reduce((acc, r) => {
    acc[r.runStatus] = (acc[r.runStatus] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const total = autoRuns.length
  const doneN = counts.completed ?? 0
  const successRate = total > 0 ? Math.round((doneN / total) * 100) : 0
  const oldest = autoRuns[autoRuns.length - 1]
  const newest = autoRuns[0]

  const proposedCount = goalsData.goals.filter((g) => g.status === 'proposed').length
  const activeCount = goalsData.goals.filter((g) => g.status === 'active').length
  const factoryOn = config?.factoryEnabled !== false
  const proposalEvents = log.filter((e) => e.event === 'factory_goal_proposal_requested').length
  const stepEpicEvents = log.filter((e) => e.event === 'factory_goal_step_epic_created').length
  const relevantLog = log.filter((e) => EVENT_LABEL[e.event]).slice(0, 20)

  // 日次グループ化（新しい日付が上）
  const byDate = new Map<string, ExecutionRun[]>()
  for (const r of detailed) {
    const k = dateKey(r.finishedAt || r.startedAt)
    if (!byDate.has(k)) byDate.set(k, [])
    byDate.get(k)!.push(r)
  }

  return (
    <article className="space-y-5">
      {/* リード（概要） */}
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h2 className={h2}>自動実行レポート</h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          AI工場は現在<span className="font-bold">{factoryOn ? '稼働中' : '停止中'}</span>です。
          これまでに自動実行を<span className="font-bold">{total}回</span>行い、うち<span className="font-bold text-emerald-600 dark:text-emerald-400">{doneN}回が完了</span>（成功率 <span className="font-bold">{successRate}%</span>）。
          調査からのゴール提案は<span className="font-bold">{proposalEvents}回</span>、達成に向けた「次の一歩」の自動作成は<span className="font-bold">{stepEpicEvents}回</span>行われました。
          現在、承認待ちのゴール候補が<span className="font-bold">{proposedCount}件</span>、進行中の目標が<span className="font-bold">{activeCount}件</span>あります。
        </p>
        <p className="mt-2 text-[11px] text-gray-400">
          記録期間: {fmtDateTime(oldest?.startedAt)} 〜 {fmtDateTime(newest?.finishedAt || newest?.startedAt)}・毎日 {SCHEDULE.join(' / ')}（JST）に自動実行
        </p>
      </section>

      {/* 数値サマリー */}
      <section className={card}>
        <h3 className={h3}>サマリー</h3>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
          <Stat label="自動実行 計" value={total} tone="text-gray-700 dark:text-gray-200" />
          <Stat label="完了" value={doneN} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="一部完了" value={counts.partial ?? 0} tone="text-amber-600 dark:text-amber-400" />
          <Stat label="失敗" value={counts.failed ?? 0} tone="text-red-600 dark:text-red-400" />
          <Stat label="成功率" value={`${successRate}%`} tone="text-blue-600 dark:text-blue-400" />
          <Stat label="提案/次の一歩" value={`${proposalEvents}/${stepEpicEvents}`} tone="text-violet-600 dark:text-violet-400" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Link href="/decide?tab=goalApproval" className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/15 dark:text-blue-300">承認待ちゴール候補 {proposedCount}件 →</Link>
          <Link href="/goal-planner" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">進行中の目標 {activeCount}件</Link>
          <Link href="/logs" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">全実行履歴 →</Link>
        </div>
      </section>

      {/* 日次タイムライン（詳細） */}
      <section className="space-y-4">
        <h3 className={h3}>日次タイムライン（直近{detailed.length}件の詳細）</h3>
        {byDate.size === 0 ? (
          <p className={`${card} text-xs text-gray-500 dark:text-gray-400`}>まだ自動実行の記録がありません。次回の定時実行（{SCHEDULE.join(' / ')}）で記録されます。</p>
        ) : (
          Array.from(byDate.entries()).map(([date, dayRuns]) => (
            <div key={date} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">{date}</h4>
                <span className="text-[10px] text-gray-400">{dayRuns.length}件</span>
              </div>
              {dayRuns.map((r) => (
                <RunDetail key={r.runId} run={r} />
              ))}
            </div>
          ))
        )}
      </section>

      {/* 自動化の動き（ログ） */}
      <section className={card}>
        <h3 className={h3}>自動化の動き（最近{relevantLog.length}件）</h3>
        {relevantLog.length === 0 ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">記録がありません。</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {relevantLog.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-2 text-[11px]">
                <span className="min-w-0 text-gray-700 dark:text-gray-200">
                  <span className="font-semibold">{EVENT_LABEL[e.event]}</span>
                  {e.fallbackReason && <span className="text-gray-500 dark:text-gray-400">：{e.fallbackReason.split('\n')[0].slice(0, 80)}</span>}
                </span>
                <span className="shrink-0 text-gray-400">{fmtDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  )
}

function RunDetail({ run: r }: { run: ExecutionRun }) {
  const checks = Object.entries(r.checks ?? {}).filter(([, v]) => v && String(v).trim())
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-bold text-gray-900 dark:text-gray-100">{r.targetTodoTitle || '(無題の自動実行)'}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[r.runStatus] ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[r.runStatus] ?? r.runStatus}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-gray-400">{fmtTime(r.finishedAt || r.startedAt)}{r.epicId ? ` ・ ${r.epicId}` : ''}{r.source ? ` ・ ${r.source}` : ''}</p>

      {r.summary && <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{r.summary}</p>}

      {r.changedFiles?.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">変更ファイル（{r.changedFiles.length}）</p>
          <ul className="mt-0.5 space-y-0.5">
            {r.changedFiles.slice(0, 8).map((f, i) => (
              <li key={i} className="text-[10px] text-gray-600 dark:text-gray-300">
                <span className="font-mono text-gray-500 dark:text-gray-400">{f.file}</span>{f.change ? ` — ${f.change}` : ''}
              </li>
            ))}
            {r.changedFiles.length > 8 && <li className="text-[10px] text-gray-400">…ほか{r.changedFiles.length - 8}件</li>}
          </ul>
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {checks.map(([k, v]) => (
            <span key={k} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {CHECK_LABEL[k] ?? k}: {String(v).slice(0, 24)}
            </span>
          ))}
        </div>
      )}

      {r.errors?.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {r.errors.slice(0, 5).map((e, i) => <li key={i} className="text-[10px] text-red-600 dark:text-red-400">✗ {e}</li>)}
        </ul>
      )}
      {r.warnings?.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {r.warnings.slice(0, 5).map((w, i) => <li key={i} className="text-[10px] text-amber-600 dark:text-amber-400">⚠ {w}</li>)}
        </ul>
      )}
      {r.nextActions?.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">次のアクション</p>
          <ul className="mt-0.5 space-y-0.5">
            {r.nextActions.slice(0, 5).map((a, i) => <li key={i} className="text-[10px] text-gray-600 dark:text-gray-300">→ {a}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-2 dark:bg-gray-800/50">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  )
}
