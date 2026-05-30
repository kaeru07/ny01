export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEpicDetail } from '@/lib/operations-store'
import type { EpicDetail } from '@/lib/types/operations'
import ResumeButton from '@/components/epic/ResumeButton'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: '実行中', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  paused: { label: '停止中', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  blocked: { label: '停止中', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  done: { label: '完了', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
}

function StatusBadge({ detail }: { detail: EpicDetail }) {
  // 承認待ちがあれば最優先で「承認待ち」を見せる
  if (detail.pendingApprovals.length > 0) {
    return (
      <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
        承認待ち {detail.pendingApprovals.length}件
      </span>
    )
  }
  const s = STATUS_LABEL[detail.epic.status] ?? STATUS_LABEL.paused
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>
}

function Section({ title, href, hrefLabel, children }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
            {hrefLabel ?? 'すべて見る'} →
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

function fmt(dt: string): string {
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function EpicDetailPage({ params }: { params: { epicId: string } }) {
  const detail = await getEpicDetail(params.epicId)
  if (!detail) notFound()

  const { epic, latestRun, recentRuns, recentDecisions, nextActions, pendingApprovals, automation, runScope } = detail

  return (
    <div className="space-y-4 px-4 pb-4 pt-6">
      {/* ヘッダー: Epic名 / 状態 / 進捗 */}
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <Link href="/epic" className="text-xs text-gray-400 hover:underline">工場</Link>
          <span className="text-xs text-gray-300">/</span>
          <span className="text-xs text-gray-500">{epic.epicId}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{epic.title}</h1>
          <StatusBadge detail={detail} />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{epic.goal}</p>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>進捗</span>
            <span>{epic.progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, epic.progress))}%` }} />
          </div>
        </div>
      </header>

      {/* Automation 状態（最低限: executor / running / stopped / 承認待ち件数） */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">自動実行の状態</h2>
          <Link href="/automation" className="text-xs text-blue-600 hover:underline dark:text-blue-400">制御へ →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{automation.running}</div>
            <div className="text-[11px] text-gray-500">実行中</div>
          </div>
          <div className="rounded-lg bg-gray-50 py-2 dark:bg-gray-800/50">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{automation.stopped}</div>
            <div className="text-[11px] text-gray-500">停止中</div>
          </div>
          <div className={`rounded-lg py-2 ${automation.pendingApproval > 0 ? 'bg-rose-50 dark:bg-rose-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{automation.pendingApproval}</div>
            <div className="text-[11px] text-gray-500">承認待ち</div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {automation.executors
            .filter((e) => e.runnable > 0 || e.running > 0)
            .map((e) => (
              <span key={e.executor} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {e.executor}: 実行可{e.runnable} / 実行中{e.running}
              </span>
            ))}
        </div>
      </section>

      {/* 前回作業（最新 ExecutionRun） */}
      <Section title="前回作業" href="/logs" hrefLabel="実行履歴へ">
        {latestRun ? (
          <Link href="/logs" className="block">
            <p className="text-sm text-gray-800 dark:text-gray-200">{latestRun.summary || latestRun.targetTodoTitle}</p>
            <p className="mt-1 text-xs text-gray-400">
              {fmt(latestRun.finishedAt)} · {latestRun.executor} · {latestRun.runStatus} · {latestRun.changedFilesCount}ファイル
            </p>
          </Link>
        ) : (
          <p className="text-sm text-gray-400">まだ実行履歴がありません</p>
        )}
      </Section>

      {/* 決定事項（Decision Log） */}
      <Section title="決定事項" href="/decisions">
        {recentDecisions.length > 0 ? (
          <ul className="space-y-2">
            {recentDecisions.map((d) => (
              <li key={d.decisionId} className="text-sm text-gray-800 dark:text-gray-200">
                <span className="text-gray-500">{d.topic}</span> → {d.decision}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">この Epic に紐づく決定事項はまだありません</p>
        )}
      </Section>

      {/* 次回予定（Next Actions）+ 続きから実行 */}
      <Section title="次回予定">
        {nextActions.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {nextActions.map((a, i) => (
              <li key={`${a.sourceRunId}-${i}`} className="text-sm text-gray-800 dark:text-gray-200">
                <span className="text-gray-400">・</span> {a.title}
                <span className="ml-1 text-[11px] text-gray-400">（{a.targetApp}）</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-gray-400">次回予定はまだ生成されていません</p>
        )}
        <ResumeButton epicId={epic.epicId} />
        <p className="mt-1.5 text-center text-[11px] text-gray-400">
          前回作業・決定事項・次回予定・承認待ちから実行コンテキストを生成します
        </p>
      </Section>

      {/* 承認待ち（この Epic 分のみ。横断は /approvals） */}
      <Section title="承認待ち" href="/approvals" hrefLabel="横断管理へ">
        {pendingApprovals.length > 0 ? (
          <ul className="space-y-2">
            {pendingApprovals.map((a) => (
              <li key={a.approvalId} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm dark:border-rose-900/40 dark:bg-rose-900/20">
                <span className="font-medium text-gray-900 dark:text-gray-100">{a.title}</span>
                <span className="ml-2 text-[11px] text-rose-600">{a.priority}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">承認待ちはありません</p>
        )}
      </Section>

      {/* 実行履歴（最新数件。全件は /logs） */}
      <Section title="実行履歴" href="/logs" hrefLabel="全件へ">
        {recentRuns.length > 0 ? (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentRuns.map((r) => (
              <li key={r.runId} className="py-2 first:pt-0 last:pb-0">
                <p className="text-sm text-gray-800 dark:text-gray-200">{r.summary || r.targetTodoTitle}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{fmt(r.finishedAt)} · {r.executor} · {r.runStatus}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">実行履歴がありません</p>
        )}
        {runScope === 'global-fallback' && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            ※ この Epic への Run 紐付け（epicId / targetApps）が未設定のため、全体の直近を仮表示しています。Run に epicId が付くと自動でこの Epic 分だけに絞り込まれます。
          </p>
        )}
      </Section>

      {/* 今後（配置のみ・未実装） */}
      <section className="rounded-2xl border border-dashed border-gray-200 p-4 opacity-60 dark:border-gray-800">
        <h2 className="mb-2 text-sm font-bold text-gray-400">今後（配置のみ）</h2>
        <div className="flex flex-wrap gap-1.5 text-[11px] text-gray-400">
          <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">Executor: Claude / Codex / Both</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">Auto Resume</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">Auto Fallback</span>
          <span className="rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700">Factory 状態</span>
        </div>
      </section>
    </div>
  )
}
