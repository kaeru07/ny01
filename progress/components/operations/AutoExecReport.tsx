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

const STATUS_LABEL: Record<string, string> = { completed: '完了', partial: '一部完了', failed: '失敗', running: '実行中' }
const STATUS_BADGE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300',
  partial: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
  running: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
}
const CHECK_LABEL: Record<string, string> = { build: 'build', typescript: 'tsc', lint: 'lint', manual: '手動確認', mainScreen: '主要画面', mobileLayout: 'モバイル', mainScreens: '主要画面', iphone: 'iPhone' }

export default async function AutoExecReport() {
  const [runs, goalsData, config] = await Promise.all([
    readExecutionRuns(),
    readGoals(),
    getAutomationConfig().catch(() => null),
  ])

  const autoRuns = runs.filter(isAutoRun).sort((a, b) => ts(b.finishedAt || b.startedAt) - ts(a.finishedAt || a.startedAt))
  const articles = autoRuns.slice(0, MAX_RUNS)
  const total = autoRuns.length
  const doneN = autoRuns.filter((r) => r.runStatus === 'completed').length
  const successRate = total > 0 ? Math.round((doneN / total) * 100) : 0
  const proposedCount = goalsData.goals.filter((g) => g.status === 'proposed').length
  const activeCount = goalsData.goals.filter((g) => g.status === 'active').length
  const factoryOn = config?.factoryEnabled !== false

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

      {articles.length === 0 ? (
        <p className={`${card} text-xs text-gray-500 dark:text-gray-400`}>まだ自動実行の記録がありません。次回の定時実行（{SCHEDULE.join(' / ')}）から1実行ごとの記事が作られます。</p>
      ) : (
        articles.map((r, i) => <RunArticle key={r.runId} run={r} index={total - i} />)
      )}

      {total > articles.length && (
        <p className="text-center text-[11px] text-gray-400">さらに前の自動実行は <Link href="/logs" className="font-semibold text-blue-600 dark:text-blue-400">実行履歴</Link> で確認できます。</p>
      )}
    </article>
  )
}

function RunArticle({ run: r, index }: { run: ExecutionRun; index: number }) {
  const checks = Object.entries(r.checks ?? {}).filter(([, v]) => v && String(v).trim())
  const done = r.runStatus === 'completed'
  const reason = (r.errors ?? [])[0] || r.reviewMemo || (r.warnings ?? [])[0] || ''
  // rawReport から余計な機械情報（progressレビュー用ブロックなど）を軽く削る
  const rawBody = (r.rawReport || '').trim()

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

      {/* 概要 */}
      {r.summary && (
        <div className="mt-3">
          <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100">概要</h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{r.summary}</p>
        </div>
      )}

      {/* できたこと */}
      <div className="mt-4">
        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ できたこと</h4>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
          {done && <li>・この実行は<span className="font-semibold">完了</span>しました。</li>}
          {!done && r.changedFiles?.length > 0 && <li>・途中までで以下の変更を行いました（{r.changedFiles.length}ファイル）。</li>}
          {r.changedFiles?.length > 0 && r.changedFiles.slice(0, 12).map((f, i) => (
            <li key={i} className="text-gray-600 dark:text-gray-300"><span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{f.file}</span>{f.change ? ` — ${f.change}` : ''}</li>
          ))}
          {r.changedFiles && r.changedFiles.length > 12 && <li className="text-gray-400">…ほか{r.changedFiles.length - 12}ファイル</li>}
          {(!r.changedFiles || r.changedFiles.length === 0) && !done && <li className="text-gray-400">・ファイル変更の記録はありません。</li>}
          {(!r.changedFiles || r.changedFiles.length === 0) && done && !r.summary && <li className="text-gray-400">・詳細な変更記録はありません（下の全文を参照）。</li>}
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

      {/* 詳細レポート全文 */}
      {rawBody && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">詳細レポート全文を読む</summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-[10px] leading-relaxed text-gray-600 dark:bg-gray-800/50 dark:text-gray-300">{rawBody}</pre>
        </details>
      )}
    </section>
  )
}
