import type { CodexRun } from '@/types/codex-run'

const STATUS_STYLE: Record<string, string> = {
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  timeout: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
}

export default function CodexRunList({ runs }: { runs: CodexRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        まだ Codex 実行履歴がありません。
      </p>
    )
  }
  return (
    <ul className="space-y-3">
      {runs.map((r) => (
        <li
          key={r.runId}
          className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
              {r.runId}
            </span>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                STATUS_STYLE[r.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {r.status} / exit {r.exitCode ?? 'null'}
            </span>
          </div>
          {r.targetTodoTitle && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {r.targetTodoTitle}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {r.startedAt.replace('T', ' ').slice(0, 19)} / {r.durationMs}ms /
            sandbox={r.sandbox}
          </p>
          {r.errorMessage && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {r.errorMessage}
            </p>
          )}
          <details className="text-xs">
            <summary className="cursor-pointer text-violet-700 dark:text-violet-300">
              プロンプト
            </summary>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-gray-100">
              {r.promptUsed}
            </pre>
          </details>
          {r.stdout && (
            <details className="text-xs">
              <summary className="cursor-pointer text-violet-700 dark:text-violet-300">
                stdout
              </summary>
              <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-gray-100">
                {r.stdout}
                {r.stdoutTruncated ? '\n...(truncated)' : ''}
              </pre>
            </details>
          )}
          {r.stderr && (
            <details className="text-xs">
              <summary className="cursor-pointer text-red-600 dark:text-red-400">
                stderr
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-gray-900 p-2 text-[11px] text-red-200">
                {r.stderr}
                {r.stderrTruncated ? '\n...(truncated)' : ''}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  )
}
