'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import FallbackTaskCard, { type FallbackTask } from '@/components/pending/FallbackTaskCard'

const PRIORITY_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const RISK_OPTIONS = [
  { value: '', label: 'すべて' },
  { value: 'high', label: 'high' },
  { value: 'medium', label: 'medium' },
  { value: 'low', label: 'low' },
]

interface Props {
  tasks: FallbackTask[]
}

export default function PendingFilters({ tasks }: Props) {
  const [keyword, setKeyword] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [targetAppFilter, setTargetAppFilter] = useState('')
  const [hideBlocked, setHideBlocked] = useState(true)
  const [hideInProgress, setHideInProgress] = useState(false)

  const targetApps = useMemo(() => {
    const apps = new Set<string>()
    tasks.forEach((t) => { if (t.targetApp) apps.add(t.targetApp) })
    return Array.from(apps).sort()
  }, [tasks])

  const hasUnspecifiedApp = useMemo(() => tasks.some((t) => !t.targetApp), [tasks])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return tasks.filter((t) => {
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (riskFilter && t.risk !== riskFilter) return false
      if (targetAppFilter === '__unspecified__') {
        if (t.targetApp) return false
      } else if (targetAppFilter && t.targetApp !== targetAppFilter) {
        return false
      }
      if (hideBlocked && t.blockedReason) return false
      if (hideInProgress && t.status === 'in_progress') return false
      if (kw) {
        const hay = [t.title, t.memo, t.targetApp ?? '', t.targetPath ?? '', t.projectName]
          .join(' ')
          .toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
  }, [tasks, keyword, priorityFilter, riskFilter, targetAppFilter, hideBlocked, hideInProgress])

  const filteredHigh = useMemo(() => filtered.filter((t) => t.priority === 'high').length, [filtered])
  const filteredRiskHigh = useMemo(() => filtered.filter((t) => t.risk === 'high').length, [filtered])

  const hasActiveFilter = !!(keyword || priorityFilter || riskFilter || targetAppFilter) || !hideBlocked || hideInProgress

  function resetFilters() {
    setKeyword('')
    setPriorityFilter('')
    setRiskFilter('')
    setTargetAppFilter('')
    setHideBlocked(true)
    setHideInProgress(false)
  }

  const sel =
    'px-2 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full'

  const summaryParts: string[] = []
  if (filteredHigh > 0) summaryParts.push(`high: ${filteredHigh}件`)
  if (filteredRiskHigh > 0) summaryParts.push(`risk high: ${filteredRiskHigh}件`)
  if (hideBlocked) summaryParts.push('blocked除外中')

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              現在{' '}
              <span className="text-blue-600 dark:text-blue-400 text-base">{filtered.length}</span>
              {' '}件の着手候補があります
              {filtered.length !== tasks.length && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 font-normal">/ 全 {tasks.length} 件</span>
              )}
            </p>
            {summaryParts.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {summaryParts.join(' / ')}
              </p>
            )}
          </div>
          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline whitespace-nowrap flex-shrink-0"
            >
              リセット
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filteredHigh > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
              high {filteredHigh}件
            </span>
          )}
          {filteredRiskHigh > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
              ⚠ risk高 {filteredRiskHigh}件
            </span>
          )}
          {hideBlocked && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              blocked除外中
            </span>
          )}
          {targetAppFilter && targetAppFilter !== '__unspecified__' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {targetAppFilter}
            </span>
          )}
          {targetAppFilter === '__unspecified__' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              未指定アプリ
            </span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 space-y-2">
        <input
          type="search"
          placeholder="キーワードで検索（タイトル・メモ・アプリ名）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <div className="grid grid-cols-2 gap-2">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className={sel}>
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>優先度: {o.label}</option>
            ))}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={sel}>
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>リスク: {o.label}</option>
            ))}
          </select>
        </div>
        <select value={targetAppFilter} onChange={(e) => setTargetAppFilter(e.target.value)} className={sel}>
          <option value="">対象アプリ: すべて</option>
          {hasUnspecifiedApp && <option value="__unspecified__">未指定</option>}
          {targetApps.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <div className="flex flex-col gap-1.5 pt-0.5">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideBlocked}
              onChange={(e) => setHideBlocked(e.target.checked)}
              className="rounded"
            />
            blocked理由あり を非表示
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideInProgress}
              onChange={(e) => setHideInProgress(e.target.checked)}
              className="rounded"
            />
            作業中（in_progress）を非表示
          </label>
        </div>
      </div>

      {/* Task list or empty state */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center space-y-4">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">着手候補がありません</p>
          {tasks.length === 0 ? (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                ToDoを追加してから着手判定を行ってください。
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  href="/tasks"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  + ToDo追加へ
                </Link>
                <Link
                  href="/tasks/import"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
                >
                  ↑ JSON取り込み
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                フィルターを変更するか、blocked除外をOFFにしてください。
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  フィルターをリセット
                </button>
                {hideBlocked && (
                  <button
                    onClick={() => setHideBlocked(false)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
                  >
                    blocked除外をOFF
                  </button>
                )}
                <Link
                  href="/tasks"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
                >
                  + ToDo追加
                </Link>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((task) => (
            <FallbackTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}
