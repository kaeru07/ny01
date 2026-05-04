'use client'

import { useState } from 'react'

const TEMPLATE = {
  targetApp: "",
  targetTodoId: "",
  targetTodoTitle: "",
  runStatus: "completed",
  reviewStatus: "not_reviewed",
  summary: "",
  changedFiles: [
    "app/path/to/changed-file.tsx"
  ],
  checks: {
    build: "",
    typescript: "",
    lint: "",
    mainScreens: "",
    iphone: ""
  },
  errors: [],
  warnings: [],
  progressUpdated: false,
  nextActions: [],
  rawReport: ""
}

const TEMPLATE_JSON = JSON.stringify(TEMPLATE, null, 2)

const FETCH_EXAMPLE = `// fetch で登録する場合
const res = await fetch('http://localhost:3010/api/execution-runs', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetApp: "company-mgmt",
    targetTodoTitle: "実装したToDoのタイトル",
    runStatus: "completed",
    summary: "実施内容の要約",
    changedFiles: ["app/logs/page.tsx", "components/logs/LogList.tsx"],
    checks: { build: "OK", typescript: "OK" },
    warnings: [],
    nextActions: ["次にやること"],
    rawReport: "Claude Codeの最終報告テキスト"
  })
})
const data = await res.json()
console.log('登録完了 runId:', data.runId)`

const CURL_EXAMPLE = `# curl で登録する場合
curl -X POST http://localhost:3010/api/execution-runs \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetApp": "company-mgmt",
    "targetTodoTitle": "実装したToDoのタイトル",
    "runStatus": "completed",
    "summary": "実施内容の要約",
    "changedFiles": ["app/logs/page.tsx"],
    "checks": {"build": "OK", "typescript": "OK"},
    "warnings": [],
    "nextActions": ["次にやること"],
    "rawReport": "Claude Codeの最終報告テキスト"
  }'`

type TabKey = 'template' | 'fetch' | 'curl'

export default function RegisterTemplate() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('template')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const content: Record<TabKey, string> = {
    template: TEMPLATE_JSON,
    fetch: FETCH_EXAMPLE,
    curl: CURL_EXAMPLE,
  }

  async function handleCopy() {
    const text = content[activeTab]
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">実行履歴登録テンプレート</span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 bg-white dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
            Claude Code作業完了後に <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">POST /api/execution-runs</code> へ送信して実行履歴を登録する。
            <br />必須: <strong>targetApp / targetTodoTitle / runStatus / summary / rawReport</strong>
            <br />省略可能: runId（自動生成）/ startedAt・finishedAt（現在時刻）/ reviewStatus（not_reviewed）
          </p>

          {/* Tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
            {(
              [
                { key: 'template' as TabKey, label: 'JSONテンプレート' },
                { key: 'fetch' as TabKey, label: 'fetch例' },
                { key: 'curl' as TabKey, label: 'curl例' },
              ]
            ).map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-1.5 font-medium transition-colors ${
                  i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''
                } ${
                  activeTab === tab.key
                    ? 'bg-gray-700 dark:bg-gray-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="relative">
            <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto leading-relaxed whitespace-pre font-mono max-h-64 overflow-y-auto">
              {content[activeTab]}
            </pre>
            <button
              onClick={handleCopy}
              className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium transition-colors ${
                copyState === 'copied'
                  ? 'bg-green-600 text-white'
                  : copyState === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {copyState === 'copied' ? '✓ コピー済み' : copyState === 'error' ? '失敗' : 'コピー'}
            </button>
          </div>

          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
            <p>• runStatus: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">completed</code> / <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">failed</code> / <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">partial</code></p>
            <p>• checks の値は OK / NG / 未確認 / スキップ などの文字列</p>
            <p>• 登録成功時レスポンス: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{`{"success":true,"runId":"..."}`}</code></p>
          </div>
        </div>
      )}
    </div>
  )
}
