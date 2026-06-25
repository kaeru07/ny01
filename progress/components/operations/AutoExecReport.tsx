import Link from 'next/link'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals } from '@/lib/goal-reader'
import { getAutomationConfig, getEpics } from '@/lib/operations-store'
import type { ExecutionRun } from '@/types/execution-run'
import type { Epic } from '@/lib/types/operations'

// 運用ページ「自動実行レポート」タブ。
// 「1実行＝1記事（約1ページ）」で、その自動実行で できたこと/できなかったこと(と理由)/
// 変更ファイル/検証/次にやること/詳細レポート全文 を深く残す。常に ExecutionRun から都度生成。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const runCard = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm'

const SCHEDULE = ['11:00', '14:00', '16:00', '23:00']
const MAX_RUNS = 25

type ReportSearch = {
  q?: string
  range?: string
  status?: string
  executor?: string
  app?: string
  review?: string
  limit?: string
}

type RunContext = {
  epic?: Epic
  goalId?: string
  goalTitle?: string
  todoTitle?: string
}

export function isAutoRun(r: ExecutionRun): boolean {
  return r.factoryRun === true || (typeof r.source === 'string' && /factory|schedule|boot/.test(r.source))
}
function ts(iso?: string): number {
  const t = Date.parse(iso ?? '')
  return Number.isNaN(t) ? 0 : t
}
function fmtFull(iso?: string): string {
  const d = new Date(iso ?? '')
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(startedAt?: string, finishedAt?: string): string {
  const start = ts(startedAt)
  const end = ts(finishedAt)
  if (!start || !end || end < start) return '—'
  const sec = Math.round((end - start) / 1000)
  if (sec < 60) return `${sec}秒`
  const min = Math.floor(sec / 60)
  const rest = sec % 60
  if (min < 60) return rest ? `${min}分${rest}秒` : `${min}分`
  const hour = Math.floor(min / 60)
  const restMin = min % 60
  return restMin ? `${hour}時間${restMin}分` : `${hour}時間`
}

const RANGE_OPTS: Array<{ key: string; label: string; days: number | null }> = [
  { key: '7', label: '7日', days: 7 },
  { key: '30', label: '30日', days: 30 },
  { key: '90', label: '90日', days: 90 },
  { key: 'all', label: '全期間', days: null },
]
const STATUS_OPTS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'completed', label: '完了' },
  { key: 'partial', label: '一部完了' },
  { key: 'failed', label: '失敗' },
  { key: 'running', label: '実行中' },
]
const REVIEW_OPTS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'not_reviewed', label: '未レビュー' },
  { key: 'reviewed', label: 'レビュー済み' },
  { key: 'needs_followup', label: '要修正' },
  { key: 'snoozed', label: 'あとで' },
]
const EXECUTOR_LABEL: Record<string, string> = { all: 'すべて', claude: 'Claude', codex: 'Codex', manual: '手動', other: 'その他' }
const REVIEW_LABEL: Record<string, string> = {
  not_reviewed: '未レビュー',
  copied: 'コピー済み',
  reviewed: 'レビュー済み',
  needs_followup: '要修正',
  needs_human: '人間判断',
  snoozed: 'あとで',
}

const STATUS_LABEL: Record<string, string> = { completed: '完了', partial: '一部完了', failed: '失敗', running: '実行中' }
const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  running: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
}
const CHECK_LABEL: Record<string, string> = { build: 'build', typescript: 'tsc', lint: 'lint', manual: '手動確認', mainScreen: '主要画面', mobileLayout: 'モバイル', mainScreens: '主要画面', iphone: 'iPhone' }

// stopReason（内部の停止理由）を「この回が何をして、なぜ終わったか」の人間語に変換する。
// 接尾辞（例: 'epic_done（doneCriteria 7/7）'）が付くため前方一致・包含で判定する。
function describeOutcome(r: ExecutionRun): string {
  const s = (r.stopReason || '').toLowerCase()
  const has = (k: string) => s.includes(k)
  if (has('epic_done') || has('all_epics_done')) return '作業を完了し、次の作業へ進みました。'
  if (has('continue')) return '作業を一歩進め、次回の自動実行に続きます。'
  if (has('approval_required')) return 'あなたの承認待ちになり、ここで止まりました。'
  if (has('run_failed')) return '作業中にエラーが出て停止しました（下の課題を参照）。'
  if (has('rate_limited') || has('rate_limit')) return 'AIの利用上限に達して停止しました。'
  if (has('max_runs_reached')) return '1回分の実行上限（最大3作業）まで動きました。'
  if (has('manual_execution_pending')) return '手動で実行する作業として記録しました（自動実行はしていません）。'
  if (has('dry_run')) return '試走（プレビュー）のみで、実際の変更はしていません。'
  if (has('auto_requires_confirm')) return '自動起動の確認が無く、実行していません。'
  if (has('blocked_by_danger')) return '危険判断（あなたの承認）待ちのため、この回はスキップしました。'
  if (has('blocked_by_goal_unset')) return '目標が紐づいていない作業しか無く、停止しました。'
  if (has('all_blocked')) return '実行できる作業がすべてブロック中で、待機しました。'
  if (has('no_candidate')) return '実行できる作業が無く、待機しました（新しい目標・作業の登録待ち）。'
  if (has('factory_off')) return 'AI工場がOFFのため、実行していません。'
  if (has('blocked')) return '起動条件を満たさず、この回は作業を実行していません。'
  // stopReason 無し時は runStatus から最低限の結果を示す。
  if (r.runStatus === 'completed') return 'この回は完了しました。'
  if (r.runStatus === 'partial') return '一部まで進み、残りは次回に持ち越しました。'
  if (r.runStatus === 'failed') return '失敗で終わりました（下の課題を参照）。'
  if (r.runStatus === 'running') return '実行中、または途中で記録が止まっています。'
  return '結果の記録がありません。'
}

// この回が実際に「変更を伴う作業」をしたか（＝待機/スキップ/ブロックではないか）。
function didRealWork(r: ExecutionRun): boolean {
  if (r.changedFiles && r.changedFiles.length > 0) return true
  const s = (r.stopReason || '').toLowerCase()
  return /epic_done|continue|run_failed|max_runs_reached|approval_required|all_epics_done/.test(s)
}

export default async function AutoExecReport({
  range = '',
  status = '',
  q = '',
  executor = '',
  app = '',
  review = '',
  limit = '',
  basePath = '/guide',
  standalone = false,
}: ReportSearch & { basePath?: string; standalone?: boolean } = {}) {
  const [runs, goalsData, epics, config] = await Promise.all([
    readExecutionRuns(),
    readGoals(),
    getEpics(),
    getAutomationConfig().catch(() => null),
  ])

  const allAuto = runs.filter(isAutoRun).sort((a, b) => ts(b.finishedAt || b.startedAt) - ts(a.finishedAt || a.startedAt))
  const total = allAuto.length
  const doneN = allAuto.filter((r) => r.runStatus === 'completed').length
  const successRate = total > 0 ? Math.round((doneN / total) * 100) : 0
  const proposedCount = goalsData.goals.filter((g) => g.status === 'proposed').length
  const activeCount = goalsData.goals.filter((g) => g.status === 'active').length
  const factoryOn = config?.factoryEnabled !== false
  const goalById = new Map(goalsData.goals.map((g) => [g.id, g]))
  const epicById = new Map(epics.map((e) => [e.epicId, e]))
  const contexts = new Map<string, RunContext>()
  for (const run of allAuto) {
    const epic = run.epicId ? epicById.get(run.epicId) : undefined
    const goal = epic?.goalId ? goalById.get(epic.goalId) : undefined
    contexts.set(run.runId, {
      epic,
      goalId: epic?.goalId ?? run.selection?.selectedGoalKey,
      goalTitle: goal?.title ?? run.selection?.selectedGoalTitle ?? epic?.goal,
      todoTitle: run.targetTodoTitle || epic?.title,
    })
  }

  // フィルタ: 期間（既定30日）＋状態/実行者/アプリ/レビュー/検索語
  const rangeKey = RANGE_OPTS.some((o) => o.key === range) ? range : '30'
  const statusKey = STATUS_OPTS.some((o) => o.key === status) ? status : 'all'
  const reviewKey = REVIEW_OPTS.some((o) => o.key === review) ? review : 'all'
  const rawExecutor = executor || 'all'
  const executorKey = ['all', 'claude', 'codex', 'manual', 'other'].includes(rawExecutor) ? rawExecutor : 'other'
  const appOptions = Array.from(new Set(allAuto.map((r) => r.targetApp).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  const appKey = appOptions.includes(app) ? app : 'all'
  const query = q.trim().toLowerCase()
  const requestedLimit = Number.parseInt(limit || '', 10)
  const displayLimit = Number.isFinite(requestedLimit) && requestedLimit > MAX_RUNS ? Math.min(requestedLimit, 200) : MAX_RUNS
  const rangeDays = RANGE_OPTS.find((o) => o.key === rangeKey)?.days ?? null
  const cutoff = rangeDays != null ? Date.now() - rangeDays * 86_400_000 : 0
  const filtered = allAuto.filter((r) => {
    if (rangeDays != null && ts(r.finishedAt || r.startedAt) < cutoff) return false
    if (statusKey !== 'all' && r.runStatus !== statusKey) return false
    const actualExecutor = r.executorUsed ?? 'other'
    if (executorKey !== 'all' && (executorKey === 'other' ? !['claude', 'codex', 'manual'].includes(actualExecutor) : actualExecutor !== executorKey)) return false
    if (appKey !== 'all' && r.targetApp !== appKey) return false
    if (reviewKey !== 'all' && r.reviewStatus !== reviewKey) return false
    if (query) {
      const c = contexts.get(r.runId)
      const haystack = [
        r.targetTodoTitle,
        r.summary,
        r.rawReport,
        r.targetApp,
        r.runId,
        c?.epic?.title,
        c?.goalTitle,
        ...(r.changedFiles ?? []).flatMap((f) => [f.file, f.change]),
      ].join('\n').toLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  const articles = filtered.slice(0, displayLimit)
  const periodStats = {
    completed: filtered.filter((r) => r.runStatus === 'completed').length,
    partial: filtered.filter((r) => r.runStatus === 'partial').length,
    failed: filtered.filter((r) => r.runStatus === 'failed').length,
    running: filtered.filter((r) => r.runStatus === 'running').length,
    unreviewed: filtered.filter((r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup').length,
  }
  const byExecutor = filtered.reduce<Record<string, number>>((acc, r) => {
    const key = r.executorUsed ?? 'other'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const chip = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`
  const hrefWith = (patch: Partial<ReportSearch>) => {
    const p = new URLSearchParams()
    if (!standalone) p.set('tab', 'report')
    const current: Required<ReportSearch> = {
      q: q.trim(),
      range: rangeKey,
      status: statusKey,
      executor: executorKey,
      app: appKey,
      review: reviewKey,
      limit: String(displayLimit),
    }
    for (const [key, value] of Object.entries({ ...current, ...patch })) {
      if (!value || value === 'all' || (key === 'range' && value === '30') || (key === 'limit' && value === String(MAX_RUNS))) continue
      p.set(key, value)
    }
    const qs = p.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  return (
    <article className="space-y-5">
      {/* 全体リード */}
      <section className={`${card} border-2 border-blue-200 dark:border-blue-900/50`}>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">自動実行レポート（1実行＝1記事）</h2>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          AI工場は現在<span className="font-bold">{factoryOn ? '稼働中' : '停止中'}</span>。累計<span className="font-bold">{total}回</span>の自動実行のうち<span className="font-bold text-emerald-600 dark:text-emerald-400">{doneN}回完了</span>（成功率<span className="font-bold">{successRate}%</span>）。
          承認待ちのゴール候補<span className="font-bold">{proposedCount}件</span>・進行中の目標<span className="font-bold">{activeCount}件</span>。
          以下は<span className="font-bold">1回の自動実行ごとの詳細記事</span>です（新しい順・最大{MAX_RUNS}件 / 毎日 {SCHEDULE.join(' / ')} JST に実行）。
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <Link href="/decide?tab=goalApproval" className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/15 dark:text-blue-300">承認待ちゴール候補 {proposedCount}件 →</Link>
          <Link href="/logs" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">全実行履歴 →</Link>
          {!standalone && <Link href="/report" className="rounded-lg border border-gray-200 px-2.5 py-1 font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-300">専用レポートページ →</Link>}
        </div>
      </section>

      <section className={card}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label="完了" value={`${periodStats.completed}件`} tone="emerald" />
          <Metric label="一部" value={`${periodStats.partial}件`} tone="amber" />
          <Metric label="失敗" value={`${periodStats.failed}件`} tone="red" />
          <Metric label="実行中" value={`${periodStats.running}件`} tone="blue" />
          <Metric label="未レビュー" value={`${periodStats.unreviewed}件`} tone="gray" />
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          実行者別: {Object.entries(byExecutor).length > 0 ? Object.entries(byExecutor).map(([k, v]) => `${EXECUTOR_LABEL[k] ?? k} ${v}件`).join(' / ') : '該当なし'}
        </p>
      </section>

      {/* フィルタ（検索・期間・状態・実行者・対象アプリ・レビュー） */}
      <section className={card}>
        <form action={basePath} className="mb-3 flex flex-col gap-2 sm:flex-row">
          {!standalone && <input type="hidden" name="tab" value="report" />}
          {rangeKey !== '30' && <input type="hidden" name="range" value={rangeKey} />}
          {statusKey !== 'all' && <input type="hidden" name="status" value={statusKey} />}
          {executorKey !== 'all' && <input type="hidden" name="executor" value={executorKey} />}
          {appKey !== 'all' && <input type="hidden" name="app" value={appKey} />}
          {reviewKey !== 'all' && <input type="hidden" name="review" value={reviewKey} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="title / summary / raw / changedFiles / targetApp を検索"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
          />
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900">検索</button>
          {query && <Link href={hrefWith({ q: '' })} className="rounded-lg border border-gray-200 px-4 py-2 text-center text-xs font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">解除</Link>}
        </form>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">期間</span>
          <div className="flex flex-wrap gap-1.5">
            {RANGE_OPTS.map((o) => (
              <Link key={o.key} href={hrefWith({ range: o.key })} className={chip(rangeKey === o.key)}>{o.label}</Link>
            ))}
          </div>
          <span className="ml-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">状態</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTS.map((o) => (
              <Link key={o.key} href={hrefWith({ status: o.key })} className={chip(statusKey === o.key)}>{o.label}</Link>
            ))}
          </div>
          <span className="ml-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">実行者</span>
          <div className="flex flex-wrap gap-1.5">
            {['all', 'claude', 'codex', 'other'].map((key) => (
              <Link key={key} href={hrefWith({ executor: key })} className={chip(executorKey === key)}>{EXECUTOR_LABEL[key] ?? key}</Link>
            ))}
          </div>
          <span className="ml-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">アプリ</span>
          <div className="flex flex-wrap gap-1.5">
            <Link href={hrefWith({ app: 'all' })} className={chip(appKey === 'all')}>すべて</Link>
            {appOptions.slice(0, 12).map((name) => (
              <Link key={name} href={hrefWith({ app: name })} className={chip(appKey === name)}>{name}</Link>
            ))}
          </div>
          <span className="ml-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">レビュー</span>
          <div className="flex flex-wrap gap-1.5">
            {REVIEW_OPTS.map((o) => (
              <Link key={o.key} href={hrefWith({ review: o.key })} className={chip(reviewKey === o.key)}>{o.label}</Link>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">該当 {filtered.length}件 / 表示 {articles.length}件{filtered.length > articles.length ? `（最大${displayLimit}件）` : ''}</p>
      </section>

      {articles.length === 0 ? (
        <p className={`${card} text-xs text-gray-500 dark:text-gray-400`}>この条件に一致する自動実行はありません。期間や状態のフィルタを変えてみてください。</p>
      ) : (
        articles.map((r, i) => <RunArticle key={r.runId} run={r} context={contexts.get(r.runId) ?? {}} index={filtered.length - i} />)
      )}

      {filtered.length > articles.length && (
        <div className="text-center">
          <Link href={hrefWith({ limit: String(displayLimit + MAX_RUNS) })} className="inline-flex rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
            もっと見る（次の{Math.min(MAX_RUNS, filtered.length - articles.length)}件）
          </Link>
        </div>
      )}
    </article>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'amber' | 'red' | 'blue' | 'gray' }) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    gray: 'bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  }
  return (
    <div className={`rounded-lg px-3 py-2 ${toneClass[tone]}`}>
      <p className="text-[10px] font-bold opacity-75">{label}</p>
      <p className="mt-0.5 text-base font-black">{value}</p>
    </div>
  )
}

function RunArticle({ run: r, context, index }: { run: ExecutionRun; context: RunContext; index: number }) {
  const checks = Object.entries(r.checks ?? {}).filter(([, v]) => v && String(v).trim())
  const done = r.runStatus === 'completed'
  const reason = (r.errors ?? [])[0] || r.reviewMemo || (r.warnings ?? [])[0] || ''
  const outcome = describeOutcome(r)
  const worked = didRealWork(r)
  const target = context.goalTitle || r.selection?.selectedGoalTitle || r.epicId || ''
  const pickReason = r.selection?.selectedReason || ''
  const files = r.changedFiles ?? []
  const summary = r.summary?.trim() ?? ''
  const hasNoOutputSummary = summary === '' || /^[（(]?出力なし[）)]?$/.test(summary)
  const showNoWorkBanner = !worked && (r.runStatus === 'partial' || r.runStatus === 'failed')
  // rawReport を整形（機械メタ情報を除去し、読みやすい段落に）
  const rawParas = cleanRawReport(r.rawReport || '')

  return (
    <section className={runCard}>
      {/* ヘッダ */}
      <header className="border-b border-gray-100 pb-2 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-bold text-gray-900 dark:text-gray-100">#{index} {r.targetTodoTitle || '(無題の自動実行)'}</h3>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[r.runStatus] ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[r.runStatus] ?? r.runStatus}</span>
            <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{REVIEW_LABEL[r.reviewStatus] ?? r.reviewStatus}</span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          開始 {fmtFull(r.startedAt)} ・ 終了 {fmtFull(r.finishedAt)} ・ 所要 {fmtDuration(r.startedAt, r.finishedAt)}
        </p>
      </header>

      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
        <Meta label="実行者" value={EXECUTOR_LABEL[r.executorUsed ?? 'other'] ?? r.executorUsed ?? 'その他'} />
        <Meta label="対象アプリ" value={r.targetApp || '—'} />
        <Meta label="対象Goal" value={context.goalTitle || '未紐づけ'} href={context.goalId ? `/goal-dashboard?goalId=${encodeURIComponent(context.goalId)}` : undefined} />
        <Meta label="対象todo/Epic" value={context.epic?.title || r.targetTodoTitle || '—'} href={r.epicId ? `/epic/${encodeURIComponent(r.epicId)}` : undefined} />
        <Meta label="runId" value={r.runId} mono />
        <Meta label="経路" value={r.source || r.runnerMode || '—'} />
      </div>

      {/* 結果（この回が何をして、どう終わったか — 常に表示） */}
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{outcome}</p>
        {r.summary && r.summary.trim() && r.summary.trim() !== outcome.trim() && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{r.summary}</p>
        )}
      </div>

      {showNoWorkBanner && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/15 dark:text-amber-400">
          {r.runStatus === 'partial' || hasNoOutputSummary
            ? '⏱ この回は実行担当が時間内に終わらず、成果物が残っていません（タイムアウトの可能性）。対象が大きすぎるか、実行時間の上限(FACTORY_EXECUTOR_TIMEOUT_MS)が不足している可能性があります。'
            : '⚠ この回は実行担当がエラーで停止し、成果物が残っていません。下の『できなかったこと・課題』を確認してください。'}
        </div>
      )}

      {/* 何の作業か（対象・選定理由） */}
      {(target || pickReason) && (
        <div className="mt-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          {target && <p>🎯 <span className="font-semibold text-gray-800 dark:text-gray-200">対象:</span> {target}</p>}
          {pickReason && <p className="mt-0.5">🧭 <span className="font-semibold text-gray-800 dark:text-gray-200">選んだ理由:</span> {pickReason}</p>}
          {(r.stopReason || r.doneCriteriaStatus || r.nextActionCount != null) && (
            <p className="mt-0.5">
              <span className="font-semibold text-gray-800 dark:text-gray-200">停止/進捗:</span>
              {r.stopReason ? ` ${r.stopReason}` : ''}
              {r.doneCriteriaStatus ? ` / doneCriteria=${r.doneCriteriaStatus}` : ''}
              {r.nextActionCount != null ? ` / 未達${r.nextActionCount}件` : ''}
            </p>
          )}
        </div>
      )}

      {/* やったこと（変更ファイル or 何をしたかの説明） */}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ やったこと{files.length > 0 ? `（変更 ${files.length} ファイル）` : ''}</h4>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
          {files.length > 0 ? (
            <>
              <li>・以下のファイルを変更しました（{files.length}件）。</li>
              {files.slice(0, 12).map((f, i) => (
                <li key={i} className="text-gray-600 dark:text-gray-300"><span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{f.file}</span>{f.change ? ` — ${f.change}` : ''}</li>
              ))}
              {files.length > 12 && <li className="text-gray-400">…ほか{files.length - 12}件</li>}
            </>
          ) : worked ? (
            <li>・{r.summary?.trim() || outcome}（変更ファイルの記録はこの回には残っていません）</li>
          ) : (
            <li className="text-gray-500 dark:text-gray-400">・この回はコードを変更する作業はしていません（{outcome}）</li>
          )}
        </ul>
      </div>

      {/* できなかったこと・課題 */}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400">⚠️ できなかったこと・課題</h4>
        {done && (r.errors?.length ?? 0) === 0 && (r.warnings?.length ?? 0) === 0 ? (
          <p className="mt-1 text-[11px] text-gray-400">特になし（完了）。</p>
        ) : (
          <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed">
            {!done && reason && <li className="text-gray-700 dark:text-gray-200">理由: {reason}</li>}
            {(r.errors ?? []).slice(0, 6).map((e, i) => <li key={`e${i}`} className="text-red-600 dark:text-red-400">✗ {e}</li>)}
            {(r.warnings ?? []).slice(0, 6).map((w, i) => <li key={`w${i}`} className="text-amber-600 dark:text-amber-400">⚠ {w}</li>)}
            {!done && (r.errors?.length ?? 0) === 0 && (r.warnings?.length ?? 0) === 0 && !reason && <li className="text-gray-400">未完了ですが、明確なエラー記録はありません。</li>}
          </ul>
        )}
      </div>

      {/* 検証結果 */}
      {checks.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">🔍 検証結果</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {checks.map(([k, v]) => (
              <span key={k} className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">{CHECK_LABEL[k] ?? k}: {String(v).slice(0, 40)}</span>
            ))}
          </div>
        </div>
      )}

      {/* 次にやること */}
      {r.nextActions?.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400">→ 次にやること</h4>
          <ul className="mt-1.5 space-y-0.5">
            {r.nextActions.slice(0, 8).map((a, i) => <li key={i} className="text-[11px] text-gray-600 dark:text-gray-300">→ {a}</li>)}
          </ul>
        </div>
      )}

      {/* 詳細レポート（整形済み） */}
      {rawParas.length > 0 && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">詳細レポートを読む</summary>
          <div className="mt-2 max-h-96 space-y-2 overflow-auto rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
            {rawParas.map((para, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{para}</p>
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function Meta({ label, value, href, mono = false }: { label: string; value: string; href?: string; mono?: boolean }) {
  const content = <span className={`${mono ? 'font-mono text-[10px]' : ''} truncate text-gray-800 dark:text-gray-100`}>{value}</span>
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
      <p className="mb-0.5 text-[10px] font-bold text-gray-400">{label}</p>
      {href ? <Link href={href} className="block min-w-0 truncate font-semibold text-blue-600 hover:underline dark:text-blue-400">{content}</Link> : content}
    </div>
  )
}

// rawReport を表示用に整形: 機械メタ情報（progressレビュー用ブロック・monetizationImpact 等の key:value 末尾）を除去し、段落配列にする。
function cleanRawReport(raw: string): string[] {
  let s = raw.replace(/\r/g, '')
  // 「progressレビュー用」ブロック以降を切り落とす
  s = s.split(/\n#+\s*progress\s*レビュー用/i)[0]
  s = s.split('progressレビュー用')[0]
  const META = /^(monetizationImpact|theme|obsidianSummary|obsidianSaveTarget|reviewStatus|targetTodoId|targetTodoTitle|targetApp|runStatus|progressUpdated|changedFiles|checks|nextActions|errors|warnings|runId)\s*[:：]/i
  // [factory-runner ...] / [factory-schedule ...] / executor=... の機械プレフィックス行を除去する。
  const PREFIX = /^\[factory[\w-]*\b.*\]?$|^executor\s*=/i
  const lines = s.split('\n').filter((line) => {
    const t = line.trim()
    return !META.test(t) && !PREFIX.test(t)
  })
  // 連続改行で段落分割。各段落内の単一改行は空白に。
  return lines
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
}
