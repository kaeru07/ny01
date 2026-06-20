import Link from 'next/link'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import { readGoals } from '@/lib/goal-reader'
import { getAutomationLog, getAutomationConfig } from '@/lib/operations-store'
import type { ExecutionRun } from '@/types/execution-run'

// 運用ページ「自動実行レポート」タブ。
// 「1実行＝1記事（約1ページ）」で、その自動実行で できたこと/できなかったこと(と理由)/
// 変更ファイル/検証/次にやること/詳細レポート全文 を深く残す。常に ExecutionRun から都度生成。

const card = 'rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'
const runCard = 'rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 shadow-sm'

const SCHEDULE = ['11:00', '14:00', '16:00', '23:00']
const MAX_RUNS = 25

function isAutoRun(r: ExecutionRun): boolean {
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

const RANGE_OPTS: Array<{ key: string; label: string; days: number | null }> = [
  { key: '7', label: '7日', days: 7 },
  { key: '30', label: '30日', days: 30 },
  { key: 'all', label: '全期間', days: null },
]
const STATUS_OPTS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'すべて' },
  { key: 'completed', label: '完了' },
  { key: 'partial', label: '一部完了' },
  { key: 'failed', label: '失敗' },
]

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

export default async function AutoExecReport({ range = '', status = '' }: { range?: string; status?: string } = {}) {
  const [runs, goalsData, config] = await Promise.all([
    readExecutionRuns(),
    readGoals(),
    getAutomationConfig().catch(() => null),
  ])

  const allAuto = runs.filter(isAutoRun).sort((a, b) => ts(b.finishedAt || b.startedAt) - ts(a.finishedAt || a.startedAt))
  const total = allAuto.length
  const doneN = allAuto.filter((r) => r.runStatus === 'completed').length
  const successRate = total > 0 ? Math.round((doneN / total) * 100) : 0
  const proposedCount = goalsData.goals.filter((g) => g.status === 'proposed').length
  const activeCount = goalsData.goals.filter((g) => g.status === 'active').length
  const factoryOn = config?.factoryEnabled !== false

  // フィルタ: 期間（既定30日）＋状態（既定すべて）
  const rangeKey = RANGE_OPTS.some((o) => o.key === range) ? range : '30'
  const statusKey = STATUS_OPTS.some((o) => o.key === status) ? status : 'all'
  const rangeDays = RANGE_OPTS.find((o) => o.key === rangeKey)?.days ?? null
  const cutoff = rangeDays != null ? Date.now() - rangeDays * 86_400_000 : 0
  const filtered = allAuto.filter((r) => {
    if (rangeDays != null && ts(r.finishedAt || r.startedAt) < cutoff) return false
    if (statusKey !== 'all' && r.runStatus !== statusKey) return false
    return true
  })
  const articles = filtered.slice(0, MAX_RUNS)
  const chip = (active: boolean) =>
    `rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'}`
  const hrefWith = (patch: { range?: string; status?: string }) => {
    const p = new URLSearchParams({ tab: 'report', range: rangeKey, status: statusKey })
    if (patch.range !== undefined) p.set('range', patch.range)
    if (patch.status !== undefined) p.set('status', patch.status)
    return `/guide?${p.toString()}`
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
        </div>
      </section>

      {/* フィルタ（期間・状態） */}
      <section className={card}>
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
        </div>
        <p className="mt-2 text-[11px] text-gray-400">該当 {filtered.length}件{filtered.length > MAX_RUNS ? `（新しい${MAX_RUNS}件を表示）` : ''}</p>
      </section>

      {articles.length === 0 ? (
        <p className={`${card} text-xs text-gray-500 dark:text-gray-400`}>この条件に一致する自動実行はありません。期間や状態のフィルタを変えてみてください。</p>
      ) : (
        articles.map((r, i) => <RunArticle key={r.runId} run={r} index={filtered.length - i} />)
      )}

      {filtered.length > articles.length && (
        <p className="text-center text-[11px] text-gray-400">この条件でさらに前の自動実行は <Link href="/logs" className="font-semibold text-blue-600 dark:text-blue-400">実行履歴</Link> で確認できます。</p>
      )}
    </article>
  )
}

function RunArticle({ run: r, index }: { run: ExecutionRun; index: number }) {
  const checks = Object.entries(r.checks ?? {}).filter(([, v]) => v && String(v).trim())
  const done = r.runStatus === 'completed'
  const reason = (r.errors ?? [])[0] || r.reviewMemo || (r.warnings ?? [])[0] || ''
  const outcome = describeOutcome(r)
  const worked = didRealWork(r)
  const target = r.selection?.selectedGoalTitle || r.epicId || ''
  const pickReason = r.selection?.selectedReason || ''
  const files = r.changedFiles ?? []
  // rawReport を整形（機械メタ情報を除去し、読みやすい段落に）
  const rawParas = cleanRawReport(r.rawReport || '')

  return (
    <section className={runCard}>
      {/* ヘッダ */}
      <header className="border-b border-gray-100 pb-2 dark:border-gray-800">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-bold text-gray-900 dark:text-gray-100">#{index} {r.targetTodoTitle || '(無題の自動実行)'}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[r.runStatus] ?? 'bg-gray-100 text-gray-500'}`}>{STATUS_LABEL[r.runStatus] ?? r.runStatus}</span>
        </div>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {fmtFull(r.finishedAt || r.startedAt)}
          {r.epicId ? ` ・ Epic: ${r.epicId}` : ''}{r.source ? ` ・ 経路: ${r.source}` : ''}{r.executorUsed ? ` ・ 実行者: ${r.executorUsed}` : ''}
        </p>
      </header>

      {/* 結果（この回が何をして、どう終わったか — 常に表示） */}
      <div className="mt-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{outcome}</p>
        {r.summary && r.summary.trim() && r.summary.trim() !== outcome.trim() && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">{r.summary}</p>
        )}
      </div>

      {/* 何の作業か（対象・選定理由） */}
      {(target || pickReason) && (
        <div className="mt-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          {target && <p>🎯 <span className="font-semibold text-gray-800 dark:text-gray-200">対象:</span> {target}</p>}
          {pickReason && <p className="mt-0.5">🧭 <span className="font-semibold text-gray-800 dark:text-gray-200">選んだ理由:</span> {pickReason}</p>}
        </div>
      )}

      {/* やったこと（変更ファイル or 何をしたかの説明） */}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ やったこと</h4>
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
