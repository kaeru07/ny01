export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { readAppProgress } from '@/lib/progress-reader'
import { readWorkCandidates, readWorkQueue, readWorkSession, sortedQueueItems, calcCandidateScore } from '@/lib/session-reader'
import { calcDashboardStats } from '@/lib/progress-transform'
import MorningChecklist from '@/components/morning/MorningChecklist'
import RefreshCandidatesButton from '@/components/morning/RefreshCandidatesButton'

function todayJST(): string {
  return new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}
const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }

export default async function MorningPage() {
  const [progressData, candidatesData, queueData, session] = await Promise.all([
    readAppProgress(),
    readWorkCandidates(),
    readWorkQueue(),
    readWorkSession(),
  ])

  const stats = calcDashboardStats(progressData.projects)
  const pendingCount = candidatesData.candidates.filter((c) => c.status === 'pending_decision').length
  const approvedCount = candidatesData.candidates.filter((c) => c.status === 'approved').length
  const queueActive = sortedQueueItems(queueData.items).filter(
    (i) => i.status === 'queued' || i.status === 'in_progress',
  )

  const topCandidates = [...candidatesData.candidates]
    .filter((c) => c.status === 'pending_decision')
    .sort((a, b) => calcCandidateScore(b.priority, b.estimatedEffort) - calcCandidateScore(a.priority, a.estimatedEffort))
    .slice(0, 3)

  const lastUpdated = progressData.projects.length > 0
    ? new Date(Math.max(...progressData.projects.map((p) => new Date(p.updatedAt).getTime())))
        .toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  const statItems = [
    { label: '案件数', value: stats.total, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800' },
    { label: '進行中', value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'ブロック', value: stats.blocked, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    { label: '着手待ち', value: pendingCount, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  ]

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">朝起動</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          {todayJST()}
          {lastUpdated && <span className="ml-2">· 最終更新 {lastUpdated}</span>}
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statItems.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-2.5 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Checklist */}
      <MorningChecklist />

      {/* Handoff from previous session */}
      {session.handoffText && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-300 mb-2">前回の引き継ぎ</h2>
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">
            {session.handoffText}
          </p>
        </div>
      )}

      {/* Today's recommended candidates */}
      {topCandidates.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            今日のおすすめ作業候補
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {topCandidates.map((c, i) => (
              <div key={c.id} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">{c.projectName}</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[c.priority]}`}>
                        {PRIORITY_LABEL[c.priority]}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs font-medium leading-snug text-gray-800 dark:text-gray-100">{c.taskTitle}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{c.reason}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link href="/tasks" className="block text-xs text-center text-blue-500 dark:text-blue-400 hover:underline pt-1">
            ToDo管理で確認 →
          </Link>
        </div>
      )}

      {/* Quick links */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          今日の作業を始める
        </h2>

        {/* Pending */}
        <Link href="/tasks">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 transition-colors hover:border-blue-100 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                pendingCount > 0 ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-green-100 dark:bg-green-900/40'
              }`}
            >
              <span
                className={`text-sm font-bold ${
                  pendingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'
                }`}
              >
                {pendingCount}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">承認待ちToDo</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {pendingCount > 0
                  ? `${pendingCount}件をToDo管理で確認`
                  : '承認待ちはありません'}
              </p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Queue */}
        <Link href="/queue">
          <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2.5 transition-colors hover:border-blue-100 active:scale-[0.99] dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-800">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                queueActive.length > 0 ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-gray-100 dark:bg-gray-700'
              }`}
            >
              <span
                className={`text-sm font-bold ${
                  queueActive.length > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {queueActive.length}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">今日の作業順番</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {queueActive.length > 0
                  ? `${queueActive.length}件 待機中`
                  : approvedCount > 0
                  ? `${approvedCount}件 承認済み（「自動生成」で順番を確定）`
                  : '作業キューが空'}
              </p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>

        {/* Refresh candidates */}
        <RefreshCandidatesButton />
      </div>
    </div>
  )
}
