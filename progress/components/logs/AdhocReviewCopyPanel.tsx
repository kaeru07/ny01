'use client'

import { useMemo, useState } from 'react'

function buildReviewText(title: string, context: string, output: string) {
  const normalizedTitle = title.trim() || 'キュー外・任意作業アウトプット'
  const normalizedContext = context.trim() || '集中作業モード外、またはtask queueにない作業のアウトプットです。'
  const normalizedOutput = output.trim() || 'ここにレビューしたいアウトプットを貼り付けてください。'

  return `以下はprogressアプリの通常タスクキュー外、または集中作業モード外で発生したアウトプットです。
通常のExecutionRunに紐づかない可能性がありますが、レビュー観点は通常作業と同じ粒度で確認してください。

レビュー対象:
${normalizedTitle}

前提・文脈:
${normalizedContext}

アウトプット:
${normalizedOutput}

確認したい観点:
- 目的に対してアウトプットが十分か
- 事実確認が必要な箇所が残っていないか
- 断定しすぎ、言い過ぎ、誤解を招く表現がないか
- 次にToDo化すべき作業があるか
- progressアプリにExecutionRunとして登録すべき内容か
- task queueに追加すべき継続作業があるか
- ユーザー確認が必要なリスクや未決定事項があるか`
}

export default function AdhocReviewCopyPanel() {
  const [title, setTitle] = useState('')
  const [context, setContext] = useState('')
  const [output, setOutput] = useState('')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')

  const reviewText = useMemo(
    () => buildReviewText(title, context, output),
    [title, context, output],
  )

  async function copyReviewText() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reviewText)
      } else {
        const ta = document.createElement('textarea')
        ta.value = reviewText
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyState('copied')
    } catch {
      setCopyState('error')
    } finally {
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-violet-100 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/30 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-violet-600 dark:text-violet-300">キュー外レビュー</p>
          <h2 className="mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100">任意アウトプットをレビュー用にコピー</h2>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            集中作業モード外やtask queueにない作業でも、ここに貼ればレビュー依頼文としてコピーできます。データ保存はしません。
          </p>
        </div>
        <button
          onClick={copyReviewText}
          className={`flex-shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
            copyState === 'copied'
              ? 'bg-green-600 text-white'
              : copyState === 'error'
              ? 'bg-red-500 text-white'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {copyState === 'copied' ? 'コピー済み ✓' : copyState === 'error' ? 'コピー失敗' : 'レビュー用コピー'}
        </button>
      </div>

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">レビュー対象</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: AIトレンドSNS投稿案 / キュー外で作った仕様メモ"
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">前提・文脈</span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="例: 今日のAIニュースを個人開発者向けSNS投稿に変換したい"
            rows={2}
            className="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">アウトプット</span>
          <textarea
            value={output}
            onChange={(e) => setOutput(e.target.value)}
            placeholder="ここにレビューしたいアウトプット全文を貼り付け"
            rows={8}
            className="w-full resize-y rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700"
          />
        </label>

        <details className="rounded-xl border border-white/70 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
          <summary className="cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-300">コピーされる内容を確認</summary>
          <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-700 dark:text-gray-200">
            {reviewText}
          </pre>
        </details>
      </div>
    </section>
  )
}
