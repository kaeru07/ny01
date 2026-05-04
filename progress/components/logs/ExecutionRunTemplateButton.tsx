'use client'

import { useState } from 'react'

const JSON_TEMPLATE = {
  targetApp: 'ny01/progress',
  targetTodoId: '',
  targetTodoTitle: '',
  runStatus: 'completed',
  reviewStatus: 'not_reviewed',
  summary: '',
  changedFiles: [
    { file: '', change: '' },
  ],
  checks: {
    build: 'OK',
    typescript: 'OK',
    lint: 'OK',
    mainScreen: 'OK',
    mobileLayout: 'OK',
  },
  warnings: [],
  nextActions: [],
  rawReport: '',
}

const CURL_EXAMPLE = `curl -X POST http://localhost:3010/api/execution-runs \\
  -H "Content-Type: application/json" \\
  -d '{
  "targetApp": "ny01/progress",
  "targetTodoTitle": "作業したToDoのタイトル",
  "runStatus": "completed",
  "summary": "実施内容の概要（1〜3行）",
  "changedFiles": [
    {"file": "app/tasks/page.tsx", "change": "追加"},
    {"file": "components/tasks/TaskCard.tsx", "change": "修正"}
  ],
  "checks": {
    "build": "OK",
    "typescript": "OK",
    "lint": "OK",
    "mainScreen": "OK",
    "mobileLayout": "OK"
  },
  "warnings": ["未対応事項があればここに"],
  "nextActions": ["次にやること"],
  "rawReport": "完了報告の全文をここに貼る"
}'`

type CopyMode = 'json' | 'curl'

export default function ExecutionRunTemplateButton() {
  const [copied, setCopied] = useState<CopyMode | null>(null)
  const [expanded, setExpanded] = useState(false)

  async function copy(mode: CopyMode) {
    const text = mode === 'json'
      ? JSON.stringify(JSON_TEMPLATE, null, 2)
      : CURL_EXAMPLE
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
    } catch {
      // no-op
    }
    setCopied(mode)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200 dark:border-gray-700 mb-4 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          📬 実行履歴を登録する
        </span>
        <span className="text-xs text-gray-400 flex-shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            作業完了後に{' '}
            <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-violet-600 dark:text-violet-400 font-mono">
              POST /api/execution-runs
            </code>{' '}
            へ登録してください。登録するとこの画面に実行履歴が表示されます。
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => copy('json')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                copied === 'json'
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {copied === 'json' ? '✓ コピーしました' : 'JSONテンプレートをコピー'}
            </button>
            <button
              onClick={() => copy('curl')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors border ${
                copied === 'curl'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              {copied === 'curl' ? '✓ コピーしました' : 'curlサンプルをコピー'}
            </button>
          </div>

          <details className="text-xs">
            <summary className="text-blue-500 cursor-pointer hover:text-blue-700 dark:hover:text-blue-300 select-none py-0.5">
              ▶ 各フィールドの説明
            </summary>
            <div className="mt-2 space-y-1.5 text-gray-600 dark:text-gray-400 pl-2">
              <p><code className="text-violet-600 dark:text-violet-400">targetApp</code> — 対象アプリ名 (例: ny01/progress)</p>
              <p><code className="text-violet-600 dark:text-violet-400">targetTodoTitle</code> — 作業したToDoのタイトル（必須）</p>
              <p><code className="text-violet-600 dark:text-violet-400">runStatus</code> — completed / failed / partial（必須）</p>
              <p><code className="text-violet-600 dark:text-violet-400">summary</code> — 実施内容の概要、1〜3行（必須）</p>
              <p><code className="text-violet-600 dark:text-violet-400">changedFiles</code> — [{`{ file, change }`}] 変更ファイルと内容</p>
              <p><code className="text-violet-600 dark:text-violet-400">checks</code> — build / typescript / lint / mainScreen / mobileLayout の確認結果</p>
              <p><code className="text-violet-600 dark:text-violet-400">warnings</code> — 未対応・注意点の配列</p>
              <p><code className="text-violet-600 dark:text-violet-400">nextActions</code> — 次にやるべきことの配列</p>
              <p><code className="text-violet-600 dark:text-violet-400">rawReport</code> — 完了報告の全文（必須）</p>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
