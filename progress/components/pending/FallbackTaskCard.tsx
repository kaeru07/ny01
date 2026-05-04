'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { TaskPriority, TaskStatus } from '@/types/progress'

export interface FallbackTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  memo: string
  taskPrompt?: string
  projectId: string
  projectName: string
  createdAt: string
  doneCriteria?: string[]
  allowed?: string[]
  forbidden?: string[]
  risk?: string
  blockedReason?: string
  unblockAction?: string
  nextQuestion?: string
  targetPath?: string
  targetApp?: string
}

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}
const PRIORITY_LABEL: Record<string, string> = { high: '優先:高', medium: '優先:中', low: '優先:低' }
const RISK_PILL: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  medium: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}
const STATUS_LABEL: Record<string, string> = {
  pending_approval: '承認待ち',
  todo: '未着手',
  in_progress: '作業中',
  backlog: 'バックログ',
  impl_done: '実装済',
  local_done: 'ローカル確認済',
}
const STATUS_COLOR: Record<string, string> = {
  pending_approval: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-500',
  todo: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  in_progress: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  backlog: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  impl_done: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  local_done: 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400',
}

function computeRec(task: FallbackTask): { label: string; color: string } {
  if (task.status === 'pending_approval') {
    return { label: '承認待ち', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' }
  }
  if (task.blockedReason) {
    return { label: '注意', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }
  }
  let score = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : 1
  if (task.risk === 'high') score -= 1
  if (task.targetPath) score += 1
  if (task.doneCriteria?.length) score += 1
  if (task.taskPrompt) score += 1

  if (score >= 5) return { label: '最優先', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' }
  if (score >= 3) return { label: '優先', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' }
  if (score >= 1) return { label: '通常', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' }
  return { label: '注意', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
}

function generateTaskPrompt(task: FallbackTask): string {
  const lines: string[] = [
    `# 作業指示: ${task.projectName} / ${task.title}`,
    '',
    `## 作業内容`,
    task.memo || task.title,
    '',
  ]
  if (task.taskPrompt?.trim()) {
    lines.push(`## このToDo専用の作業指示`)
    lines.push(task.taskPrompt.trim())
    lines.push('')
  }
  if (task.doneCriteria?.length) {
    lines.push(`## 完了条件`)
    task.doneCriteria.forEach((c) => lines.push(`- ${c}`))
    lines.push('')
  }
  if (task.allowed?.length) {
    lines.push(`## 許可事項`)
    task.allowed.forEach((a) => lines.push(`- ${a}`))
    lines.push('')
  }
  if (task.forbidden?.length) {
    lines.push(`## 禁止事項`)
    task.forbidden.forEach((f) => lines.push(`- ${f}`))
    lines.push('')
  }
  if (task.targetPath) lines.push(`対象パス: ${task.targetPath}`)
  lines.push(`---`)
  lines.push(`progress 正本: /root/company/apps/ny01/progress/data/real/`)
  return lines.join('\n')
}

interface Props {
  task: FallbackTask
}

export default function FallbackTaskCard({ task }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [hidden, setHidden] = useState(false)
  const [adding, setAdding] = useState(false)
  const [addedOk, setAddedOk] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(false)

  if (hidden || blocked) return null

  const rec = computeRec(task)

  async function startTask() {
    setAdding(true)
    setError('')
    const res = await fetch('/api/queue/add-from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: task.projectId, taskId: task.id }),
    })
    setAdding(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '追加失敗')
      return
    }
    setAddedOk(true)
    startTransition(() => router.refresh())
  }

  async function blockTask() {
    setBlocking(true)
    setError('')
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: task.projectId, status: 'blocked' }),
    })
    setBlocking(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '更新失敗')
      return
    }
    setBlocked(true)
    startTransition(() => router.refresh())
  }

  async function copyPrompt() {
    const prompt = generateTaskPrompt(task)
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      const el = document.createElement('textarea')
      el.value = prompt
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const dateStr = task.createdAt
    ? new Date(task.createdAt).toLocaleDateString('ja-JP', {
        timeZone: 'Asia/Tokyo',
        month: 'numeric',
        day: 'numeric',
      })
    : ''

  const hasDetails = !!(task.doneCriteria?.length || task.allowed?.length || task.forbidden?.length)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-blue-500 dark:text-blue-400 font-medium truncate">
            {task.projectName}{task.targetApp ? ` › ${task.targetApp}` : ''}
          </p>
          <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5">
            {task.title}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${rec.color}`}>
            {rec.label}
          </span>
          <div className="flex items-center gap-1 flex-wrap justify-end">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
            {task.risk && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RISK_PILL[task.risk] ?? ''}`}>
                risk:{task.risk}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Risk high warning */}
      {task.risk === 'high' && !task.blockedReason && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">
            ⚠ 危険: risk highのタスクです。作業前に影響範囲を確認してください。
          </p>
        </div>
      )}

      {/* Info badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${STATUS_COLOR[task.status] ?? 'bg-gray-100 text-gray-500'}`}>
          {STATUS_LABEL[task.status] ?? task.status}
        </span>
        {task.targetPath && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 text-xs font-mono max-w-[14rem] truncate"
            title={task.targetPath}
          >
            📁 {task.targetPath}
          </span>
        )}
        {task.taskPrompt ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-xs">
            📋 指示あり
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 text-xs">
            指示なし
          </span>
        )}
        {!!task.doneCriteria?.length && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs">
            ✓ 完了条件 {task.doneCriteria.length}件
          </span>
        )}
        {dateStr && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 text-xs">
            {dateStr}
          </span>
        )}
      </div>

      {/* Memo */}
      {task.memo && (
        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">{task.memo}</p>
      )}

      {/* pending_approval notice */}
      {task.status === 'pending_approval' && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
          <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">⏳ 承認待ち: ユーザー承認が必要です</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-0.5">「着手する」を押すと承認済みとして今日の作業に追加されます。Claude Codeはこのボタンを押すまで着手しません。</p>
        </div>
      )}

      {/* blocked warning */}
      {task.blockedReason && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 space-y-1">
          <p className="text-xs text-red-700 dark:text-red-300 font-medium">⚠ blocked理由あり</p>
          <p className="text-xs text-red-600 dark:text-red-400">{task.blockedReason}</p>
          {task.unblockAction && (
            <p className="text-xs text-orange-700 dark:text-orange-300">解除方法: {task.unblockAction}</p>
          )}
        </div>
      )}

      {/* nextQuestion */}
      {task.nextQuestion && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <p className="text-xs text-amber-700 dark:text-amber-300">❓ 次の質問: {task.nextQuestion}</p>
        </div>
      )}

      {/* Expand details */}
      {hasDetails && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400"
        >
          {expanded ? '▲ 詳細を閉じる' : '▼ 詳細を見る'}
        </button>
      )}

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-gray-50 dark:border-gray-700">
          {!!task.doneCriteria?.length && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">完了条件</p>
              <ul className="space-y-0.5">
                {task.doneCriteria.map((c, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300">・{c}</li>
                ))}
              </ul>
            </div>
          )}
          {!!task.allowed?.length && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">許可事項</p>
              <ul className="space-y-0.5">
                {task.allowed.map((a, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300">・{a}</li>
                ))}
              </ul>
            </div>
          )}
          {!!task.forbidden?.length && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">禁止事項</p>
              <ul className="space-y-0.5">
                {task.forbidden.map((f, i) => (
                  <li key={i} className="text-xs text-red-600 dark:text-red-400">・{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Copy prompt — prominent */}
      <button
        onClick={copyPrompt}
        className="w-full py-3 rounded-xl border border-violet-300 dark:border-violet-700 text-sm font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
      >
        {copied ? '✓ コピーしました' : '📋 作業開始プロンプトをコピー'}
      </button>

      {/* Action buttons */}
      {addedOk ? (
        <p className="text-xs text-green-600 dark:text-green-400 text-center font-medium py-1">
          ✓ 今日の作業に追加しました
        </p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={startTask}
              disabled={adding}
              className="py-3 rounded-xl bg-green-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-green-700 transition-colors"
            >
              {adding ? '...' : task.status === 'pending_approval' ? '承認して着手する' : '着手する'}
            </button>
            <button
              onClick={() => setHidden(true)}
              className="py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
            >
              後回し
            </button>
          </div>
          <button
            onClick={blockTask}
            disabled={blocking}
            className="w-full py-2.5 rounded-xl border border-orange-200 dark:border-orange-800 text-sm text-orange-600 dark:text-orange-400 disabled:opacity-50 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors bg-white dark:bg-gray-800"
          >
            {blocking ? '...' : 'blockedにする'}
          </button>
        </div>
      )}
    </div>
  )
}
