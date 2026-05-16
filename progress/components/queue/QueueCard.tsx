'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkQueueItem } from '@/types/session'
import CodexTrigger from '@/components/codex/CodexTrigger'

const PRIORITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  low: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
}
const PRIORITY_LABEL: Record<string, string> = { high: '高', medium: '中', low: '低' }
const STATUS_COLOR: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  skipped: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
}
const STATUS_LABEL: Record<string, string> = {
  queued: '待機中',
  in_progress: '作業中',
  done: '完了',
  blocked: 'ブロック',
  skipped: 'スキップ',
}

interface Props {
  item: WorkQueueItem
  effectiveOrder: number
  isFirst: boolean
  isLast: boolean
}

export default function QueueCard({ item, effectiveOrder, isFirst, isLast }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [memo, setMemo] = useState(item.userMemo)
  const [workLog, setWorkLog] = useState(item.workLog)
  const [taskPrompt, setTaskPrompt] = useState(item.taskPrompt ?? '')
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState('')

  async function patch(body: object) {
    setError('')
    const res = await fetch(`/api/queue/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { setError('操作失敗'); return }
    startTransition(() => router.refresh())
  }

  const isDone = item.status === 'done' || item.status === 'skipped'

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm p-4 space-y-3 transition-opacity ${
      isDone ? 'opacity-60 border-gray-100 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
          {effectiveOrder}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-blue-500 dark:text-blue-400 font-medium">{item.projectName}</p>
          <p className={`text-sm font-semibold leading-snug mt-0.5 ${
            isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
          }`}>
            {item.taskTitle}
          </p>
          {item.taskPrompt && (
            <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-violet-600 dark:text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block" />
              専用プロンプトあり
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLOR[item.priority]}`}>
            {PRIORITY_LABEL[item.priority]}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[item.status]}`}>
            {STATUS_LABEL[item.status]}
          </span>
          {item.manualOrder !== undefined && (
            <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">手動</span>
          )}
        </div>
      </div>

      {/* Reason */}
      {item.reason && (
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <span className="font-medium">理由: </span>{item.reason}
        </p>
      )}

      {/* Order control buttons */}
      {!isDone && (
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => patch({ action: 'move', direction: 'top' })} disabled={pending || isFirst}
            className="px-2 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            最優先
          </button>
          <button onClick={() => patch({ action: 'move', direction: 'up' })} disabled={pending || isFirst}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-bold">
            ↑
          </button>
          <button onClick={() => patch({ action: 'move', direction: 'down' })} disabled={pending || isLast}
            className="px-3 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors font-bold">
            ↓
          </button>
          <button onClick={() => patch({ action: 'move', direction: 'bottom' })} disabled={pending || isLast}
            className="px-2 py-1.5 text-xs rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 disabled:opacity-40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
            最後へ
          </button>
        </div>
      )}

      {/* Status action buttons */}
      <div className="flex gap-1.5 flex-wrap">
        {item.status === 'queued' && (
          <button onClick={() => patch({ action: 'status', status: 'in_progress' })} disabled={pending}
            className="px-3 py-1.5 text-xs rounded-xl bg-blue-600 text-white font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
            開始
          </button>
        )}
        {item.status === 'in_progress' && (
          <button onClick={() => patch({ action: 'status', status: 'done' })} disabled={pending}
            className="px-3 py-1.5 text-xs rounded-xl bg-green-600 text-white font-medium disabled:opacity-50 hover:bg-green-700 transition-colors">
            完了
          </button>
        )}
        {!isDone && (
          <>
            <button onClick={() => patch({ action: 'status', status: 'blocked' })} disabled={pending}
              className="px-3 py-1.5 text-xs rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 disabled:opacity-50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors bg-white dark:bg-gray-800">
              ブロック
            </button>
            <button onClick={() => patch({ action: 'status', status: 'skipped' })} disabled={pending}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800">
              スキップ
            </button>
            <button onClick={() => patch({ action: 'remove' })} disabled={pending}
              className="px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-600 text-gray-400 dark:text-gray-500 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800">
              外す
            </button>
          </>
        )}
        <button onClick={() => setExpanded((v) => !v)}
          className="px-2 py-1.5 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400">
          {expanded ? '▲ 閉じる' : '▼ 詳細'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 pt-2 border-t border-gray-50 dark:border-gray-700">
          {item.doneCondition && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">完了条件</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">{item.doneCondition}</p>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500">ユーザーメモ</label>
            <div className="flex gap-2 mt-1">
              <input value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="メモ..."
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300"
              />
              <button onClick={() => patch({ userMemo: memo })} disabled={pending}
                className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
                保存
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 dark:text-gray-500">作業ログ</label>
            <div className="flex gap-2 mt-1">
              <textarea value={workLog} onChange={(e) => setWorkLog(e.target.value)}
                placeholder="実施内容・変更ファイル・検証結果..."
                rows={3}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
              />
              <button onClick={() => patch({ workLog })} disabled={pending}
                className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 self-start">
                保存
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full ${taskPrompt.trim() ? 'bg-violet-400' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <label className="text-xs text-gray-400 dark:text-gray-500">
                実行時プロンプト（{taskPrompt.trim() ? '専用プロンプトあり' : '専用プロンプトなし'}）
              </label>
            </div>
            <div className="flex gap-2 mt-1">
              <textarea value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)}
                placeholder="このタスク専用のClaude Code実行指示（空でもOK）"
                rows={3}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-violet-300 resize-none"
              />
              <button onClick={() => patch({ taskPrompt })} disabled={pending}
                className="px-2 py-1.5 text-xs rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 disabled:opacity-50 self-start">
                保存
              </button>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                Codex 実験（保存済みプロンプトを使用 / 空ならタスク説明を使用）
              </p>
              <CodexTrigger
                compact
                prompt={(taskPrompt.trim() || item.description || item.taskTitle).trim()}
                queueItemId={item.id}
                targetTodoId={item.taskId}
                targetTodoTitle={item.taskTitle}
                projectId={item.projectId}
                projectName={item.projectName}
              />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
