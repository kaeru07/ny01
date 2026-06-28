'use client'

import Link from 'next/link'
import { useState } from 'react'

const TEMPLATE = `{
  "project": { "id": "my-new-app", "name": "新規アプリ名", "status": "active", "currentTask": "MVP実装", "nextAction": "最初の画面を作る" },
  "goals": [
    { "title": "MVPを実装する", "priority": "high", "prompt": "最初に作る中心機能の説明" },
    { "title": "App Store公開仕様にする", "priority": "medium", "prompt": "公開準備(署名・アイコン・申請仕様)" }
  ]
}`

interface ImportResult {
  success?: boolean
  projectId?: string
  goalsCreated?: number
  error?: string
}

export default function ProjectGoalsImportPage() {
  const [json, setJson] = useState(TEMPLATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    let payload: unknown
    try {
      payload = JSON.parse(json)
    } catch {
      setError('JSONの形式が正しくありません')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/projects/with-goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json() as ImportResult
      if (!response.ok) {
        setError(data.error ?? '追加に失敗しました')
        return
      }
      setResult(data)
    } catch {
      setError('追加に失敗しました。再試行してください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 px-4 pb-4 pt-4">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          プロジェクト＋ゴールを手動追加(JSON)
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          追加したゴールは active(自動実行対象)になり、自動実行キュー(/queue)で優先順位(最優先・上下)を調整できます。
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <label htmlFor="project-goals-json" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          追加するJSON
        </label>
        <textarea
          id="project-goals-json"
          value={json}
          onChange={(event) => setJson(event.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-3 font-mono text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />

        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {result?.success && result.projectId && (
          <div className="space-y-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-200">
            <p>
              プロジェクト {result.projectId} を追加 / ゴール {result.goalsCreated ?? 0}件を追加しました。次回自動実行の対象になります。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/queue" className="font-medium text-blue-600 hover:underline dark:text-blue-300">
                自動実行キューを見る
              </Link>
              <Link href="/portfolio?tab=goals" className="font-medium text-blue-600 hover:underline dark:text-blue-300">
                プロジェクト×ゴールを見る
              </Link>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !json.trim()}
          className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
        >
          {loading ? '追加中...' : '追加する'}
        </button>
      </form>
    </div>
  )
}
