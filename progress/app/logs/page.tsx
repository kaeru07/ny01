export const dynamic = 'force-dynamic'

import { readWorkLog, readAppProgress } from '@/lib/progress-reader'
import { readExecutionRuns } from '@/lib/execution-run-reader'
import LogList from '@/components/logs/LogList'
import ExecutionRunList from '@/components/logs/ExecutionRunList'
import ExecutionRunTemplateButton from '@/components/logs/ExecutionRunTemplateButton'
import ProjectFilterSelect from '@/components/logs/ProjectFilterSelect'
import AdhocReviewCopyPanel from '@/components/logs/AdhocReviewCopyPanel'
import SnsTrendReviewPanel from '@/components/logs/SnsTrendReviewPanel'

type LogMode = 'event' | 'history' | 'review' | 'daily'

interface Props {
  searchParams: { project?: string; type?: string; mode?: string }
}

export default async function LogsPage({ searchParams }: Props) {
  const mode: LogMode =
    searchParams.mode === 'history' ? 'history'
    : searchParams.mode === 'review' ? 'review'
    : searchParams.mode === 'daily' ? 'daily'
    : 'event'

  const [logs, progressData, allRuns] = await Promise.all([
    readWorkLog(),
    readAppProgress(),
    readExecutionRuns(),
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
    : filteredRuns.length

  return (
    <div className="px-4 pt-6 pb-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">ログ</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{displayCount} 件</p>
      </header>

      {/* Mode switch */}
      <div className="flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-4">
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
      <div className="mb-3">
        <ProjectFilterSelect
          projects={projects}
          currentProject={projectFilter}
          currentMode={mode !== 'event' ? mode : undefined}
          currentType={typeFilter}
        />
      </div>

      {/* Type filter (event mode only) */}
      {mode === 'event' && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
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
          <ExecutionRunTemplateButton />
          <ExecutionRunList initialRuns={filteredRuns} reviewOnly={false} />
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
