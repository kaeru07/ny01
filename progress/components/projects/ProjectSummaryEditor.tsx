'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Project, ProjectStatus } from '@/types/progress'
import { getStatusLabel } from '@/lib/progress-transform'

const STATUS_OPTIONS: ProjectStatus[] = [
  'in_progress',
  'active',
  'user_action_pending',
  'deploy_ready',
  'done',
  'blocked',
  'archived',
]

interface Props {
  project: Project
}

export default function ProjectSummaryEditor({ project }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const [form, setForm] = useState({
    currentTask: project.currentTask,
    nextAction: project.nextAction,
    progress: project.progress,
    status: project.status,
    phase: project.phase,
    url: project.url ?? '',
  })

  function resetForm() {
    setForm({
      currentTask: project.currentTask,
      nextAction: project.nextAction,
      progress: project.progress,
      status: project.status,
      phase: project.phase,
      url: project.url ?? '',
    })
  }

  async function handleSave() {
    setLoading(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed')
      setSaved(true)
      setEditing(false)
      router.refresh()
    } catch {
      setError('保存に失敗しました。再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    resetForm()
    setEditing(false)
    setError('')
    setSaved(false)
  }

  if (!editing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">サマリー</span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-500">保存しました</span>}
            <button
              onClick={() => { setEditing(true); setSaved(false) }}
              className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <span>✎</span> 編集
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">現在のタスク</p>
            <p className="text-sm text-gray-800 dark:text-gray-100 font-medium">{project.currentTask}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">次のアクション</p>
            <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">{project.nextAction}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                <span>進捗</span>
                <span className="font-semibold text-gray-700 dark:text-gray-300">{project.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">ステータス</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{getStatusLabel(project.status)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">フェーズ</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{project.phase}</p>
            </div>
          </div>
          {project.url && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">URL</p>
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-500 hover:underline break-all"
              >
                {project.url}
              </a>
            </div>
          )}
        </div>

        {project.blockers.length > 0 && (
          <div className="pt-2 border-t border-gray-50 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">ブロッカー</p>
            {project.blockers.map((b, i) => (
              <p key={i} className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <span>⚠</span> {b}
              </p>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">サマリー編集</span>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">現在のタスク</label>
          <input
            type="text"
            value={form.currentTask}
            onChange={(e) => setForm((f) => ({ ...f, currentTask: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">次のアクション</label>
          <input
            type="text"
            value={form.nextAction}
            onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            進捗 <span className="font-semibold text-gray-800 dark:text-gray-200">{form.progress}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={form.progress}
            onChange={(e) => setForm((f) => ({ ...f, progress: Number(e.target.value) }))}
            className="w-full h-8 accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 -mt-1">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ステータス</label>
            <select
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{getStatusLabel(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">フェーズ</label>
            <input
              type="text"
              value={form.phase}
              onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">URL（任意）</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="https://..."
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
        >
          {loading ? '保存中...' : '保存'}
        </button>
        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
        >
          キャンセル
        </button>
      </div>
    </div>
  )
}
