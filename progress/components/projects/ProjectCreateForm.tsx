'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectStatus } from '@/types/progress'
import { getStatusLabel } from '@/lib/progress-transform'

const STATUS_OPTIONS: ProjectStatus[] = ['in_progress', 'active', 'done', 'blocked', 'archived']

export default function ProjectCreateForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    id: '',
    name: '',
    status: 'in_progress' as ProjectStatus,
    phase: '',
    progress: 0,
    currentTask: '',
    nextAction: '',
    url: '',
  })

  function sanitizeId(raw: string) {
    return raw.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.id.trim() || !form.name.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { success?: boolean; error?: string; id?: string }

      if (!res.ok) {
        setError(data.error ?? '追加に失敗しました')
        return
      }

      router.push(`/projects/${form.id}`)
      router.refresh()
    } catch {
      setError('追加に失敗しました。再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">案件 ID <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: sanitizeId(e.target.value) }))}
            placeholder="my-project"
            required
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono bg-white dark:bg-gray-700 dark:text-gray-100"
          />
          <p className="text-xs text-gray-400 mt-0.5">英小文字・数字・ハイフンのみ</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">案件名 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Project"
            required
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ステータス</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProjectStatus }))}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
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
            placeholder="planning"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          進捗 <span className="font-semibold text-gray-800">{form.progress}%</span>
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
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">現在のタスク</label>
        <input
          type="text"
          value={form.currentTask}
          onChange={(e) => setForm((f) => ({ ...f, currentTask: e.target.value }))}
          placeholder="最初にやること"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">次のアクション</label>
        <input
          type="text"
          value={form.nextAction}
          onChange={(e) => setForm((f) => ({ ...f, nextAction: e.target.value }))}
          placeholder="次にやること"
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">URL（任意）</label>
        <input
          type="url"
          value={form.url}
          onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
          placeholder="https://..."
          className="w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !form.id.trim() || !form.name.trim()}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors"
      >
        {loading ? '追加中...' : '案件を追加'}
      </button>
    </form>
  )
}
