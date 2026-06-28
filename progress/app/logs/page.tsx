export const dynamic = 'force-dynamic'

import { readWorkLog, readAppProgress } from '@/lib/progress-reader'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import LogList from '@/components/logs/LogList'
import ExecutionRunList from '@/components/logs/ExecutionRunList'
import ExecutionRunTemplateButton from '@/components/logs/ExecutionRunTemplateButton'
import ProjectFilterSelect from '@/components/logs/ProjectFilterSelect'
import AdhocReviewCopyPanel from '@/components/logs/AdhocReviewCopyPanel'
import SnsTrendReviewPanel from '@/components/logs/SnsTrendReviewPanel'
import { readExecutionRunArchiveSummaries } from '@/lib/execution-run-archive'

type LogMode = 'event' | 'history' | 'review' | 'daily'

interface Props {
  searchParams: { project?: string; type?: string; mode?: string; factory?: string }
}

// 定期実行(Factory/スケジュール)由来の Run か。ExecutionRun の既存フィールドだけで判定（新JSON不要）。
function isFactoryRun(r: { factoryRun?: boolean; source?: string; trigger?: string }): boolean {
  return (
    r.factoryRun === true ||
    r.source === 'schedule' ||
    r.source === 'boot' ||
    r.source === 'factory_runner' ||
    r.trigger === 'systemd' ||
    r.trigger === 'cron' ||
    r.trigger === 'startup'
  )
}

export default async function LogsPage({ searchParams }: Props) {
  const mode: LogMode =
    searchParams.mode === 'history' ? 'history'
    : searchParams.mode === 'review' ? 'review'
    : searchParams.mode === 'daily' ? 'daily'
    : 'event'

  const [logs, progressData, allRuns, archives] = await Promise.all([
    readWorkLog(),
    readAppProgress(),
    readExecutionRuns(),
    readExecutionRunArchiveSummaries(),
  ])

  const { project: projectFilter, type: typeFilter } = searchParams
  const projects = progressData.projects

  const filteredLogs = logs.filter((l) => {
    if (projectFilter && l.project !== projectFilter) return false
    if (typeFilter && l.type !== typeFilter) return false
    return true
  })

  const filteredRuns = allRuns.filter((r) => {
    if (projectFilter && r.targetApp !== projectFilter) return false
    return true
  })

  // 実行履歴モードで「定期実行のみ」フィルタが有効なら Factory/スケジュール由来に絞る。
  const factoryOnly = mode === 'history' && searchParams.factory === '1'
  const historyRuns = factoryOnly ? filteredRuns.filter(isFactoryRun) : filteredRuns
  const factoryRunCount = filteredRuns.filter(isFactoryRun).length

  const reviewPendingCount = allRuns.filter(
    (r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup'
  ).length

  const logTypes = [
    { value: '', label: 'すべて' },
    { value: 'task_started', label: '開始' },
    { value: 'task_completed', label: '完了' },
    { value: 'task_added', label: '追加' },
    { value: 'blocker', label: 'ブロック' },
    { value: 'summary', label: 'サマリー' },
  ]

  function buildUrl(params: Record<string, string>) {
    const base: Record<string, string> = {}
    if (mode !== 'event') base.mode = mode
    if (projectFilter) base.project = projectFilter
    if (typeFilter) base.type = typeFilter
    Object.assign(base, params)
    Object.keys(base).forEach((k) => { if (!base[k]) delete base[k] })
    const qs = new URLSearchParams(base).toString()
    return '/logs' + (qs ? '?' + qs : '')
  }

  function modeUrl(m: LogMode) {
    if (m === 'daily') return '/daily'
    const base: Record<string, string> = {}
    if (m !== 'event') base.mode = m
    if (projectFilter) base.project = projectFilter
    const qs = new URLSearchParams(base).toString()
    return '/logs' + (qs ? '?' + qs : '')
  }

  const displayCount =
    mode === 'event' ? filteredLogs.length
    : mode === 'review' ? filteredRuns.filter(
        (r) => r.reviewStatus === 'not_reviewed' || r.reviewStatus === 'copied' || r.reviewStatus === 'needs_followup'
      ).length
    : historyRuns.length

  return (
    <div className="px-4 pb-4 pt-4">
      <header className="mb-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ログ</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{displayCount} 件</p>
      </header>

      {/* Mode switch */}
      <div className="mb-3 flex overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        {(
          [
            { value: 'event' as LogMode, label: 'イベント' },
            { value: 'history' as LogMode, label: '実行履歴' },
            { value: 'review' as LogMode, label: `レビュー${reviewPendingCount > 0 ? ` ${reviewPendingCount}` : ''}` },
            { value: 'daily' as LogMode, label: '日別' },
          ] as const
        ).map((item, i) => (
          <a
            key={item.value}
            href={modeUrl(item.value)}
            className={`flex-1 text-center py-2 text-xs font-medium transition-colors ${
              i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''
            } ${
              mode === item.value
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* Project filter */}
      <div className="mb-2">
        <ProjectFilterSelect
          projects={projects}
          currentProject={projectFilter}
          currentMode={mode !== 'event' ? mode : undefined}
          currentType={typeFilter}
        />
      </div>

      {/* Type filter (event mode only) */}
      {mode === 'event' && (
        <div className="scrollbar-hide mb-3 flex gap-2 overflow-x-auto pb-1">
          {logTypes.map((t) => (
            <a
              key={t.value}
              href={buildUrl({ type: t.value })}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                (typeFilter ?? '') === t.value
                  ? 'bg-gray-700 dark:bg-gray-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {t.label}
            </a>
          ))}
        </div>
      )}

      {/* Content */}
      {mode === 'event' && <LogList logs={filteredLogs} />}
      {mode === 'history' && (
        <>
          {/* 定期実行(Factory)フィルタ: 既存 ExecutionRun を source/trigger/factoryRun で絞る（新規ページ/JSON/API なし） */}
          <div className="mb-3 flex gap-2">
            <a
              href={buildUrl({ factory: '' })}
              className={`flex-1 text-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                !factoryOnly
                  ? 'bg-gray-700 dark:bg-gray-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              すべての実行 {filteredRuns.length}
            </a>
            <a
              href={buildUrl({ factory: '1' })}
              className={`flex-1 text-center rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                factoryOnly
                  ? 'bg-violet-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              🏭 定期実行のみ {factoryRunCount}
            </a>
          </div>
          {archives.length > 0 && (
            <section className="mb-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">アーカイブ済み作業履歴</p>
              <p className="mt-1 text-[11px] text-gray-400">通常表示は最新のアクティブ履歴だけです。過去分は月別ファイルに退避されています。</p>
              <dl className="mt-2 grid grid-cols-2 gap-1.5">
                {archives.map((archive) => (
                  <div key={archive.file} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs dark:bg-gray-800/50">
                    <dt className="font-mono text-gray-500 dark:text-gray-400">{archive.file}</dt>
                    <dd className="font-semibold text-gray-700 dark:text-gray-200">{archive.count}件</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          <ExecutionRunTemplateButton />
          <ExecutionRunList initialRuns={historyRuns} reviewOnly={false} />
        </>
      )}
      {mode === 'review' && (
        <>
          <AdhocReviewCopyPanel />
          <SnsTrendReviewPanel />
          <ExecutionRunList initialRuns={filteredRuns} reviewOnly={true} />
        </>
      )}
    </div>
  )
}
