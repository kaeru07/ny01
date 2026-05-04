'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ExecutionRun, ReviewStatus } from '@/types/execution-run'

const RUN_STATUS_LABEL: Record<string, string> = {
  running: '実行中',
  completed: '完了',
  failed: '失敗',
  partial: '一部完了',
}

const RUN_STATUS_COLOR: Record<string, string> = {
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
}

const REVIEW_STATUS_LABEL: Record<string, string> = {
  not_reviewed: '未レビュー',
  copied: 'コピー済み',
  reviewed: 'レビュー済み',
  needs_followup: '要フォロー',
}

const REVIEW_STATUS_COLOR: Record<string, string> = {
  not_reviewed: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  copied: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  reviewed: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  needs_followup: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
}

function buildReviewCopyText(run: ExecutionRun): string {
  const changedFilesText = run.changedFiles.length > 0
    ? run.changedFiles.map((f) => f.change ? `- ${f.file}: ${f.change}` : `- ${f.file}`).join('\n')
    : '- なし'

  const checksText = [
    `- build: ${run.checks.build ?? '未確認'}`,
    `- TypeScript: ${run.checks.typescript ?? '未確認'}`,
    `- lint: ${run.checks.lint ?? '未確認'}`,
    `- 主要画面: ${run.checks.mainScreen ?? run.checks.mainScreens ?? '未確認'}`,
    `- モバイル表示: ${run.checks.mobileLayout ?? run.checks.iphone ?? '未確認'}`,
  ].join('\n')

  const warningsText = run.warnings.length > 0
    ? run.warnings.map((w) => `- ${w}`).join('\n')
    : '- なし'

  const nextActionsText = run.nextActions.length > 0
    ? run.nextActions.map((a) => `- ${a}`).join('\n')
    : '- なし'

  const startedAt = new Date(run.startedAt).toLocaleString('ja-JP')
  const finishedAt = new Date(run.finishedAt).toLocaleString('ja-JP')

  return `以下はClaude Code実行後の報告です。
抜け漏れ、進め方の妥当性、危険な変更、追加改善案、次にやるべきことをレビューしてください。

対象アプリ: ${run.targetApp}
対象ToDo: ${run.targetTodoTitle}
作業日時: ${startedAt} - ${finishedAt}
作業ステータス: ${RUN_STATUS_LABEL[run.runStatus] ?? run.runStatus}
レビュー状態: ${REVIEW_STATUS_LABEL[run.reviewStatus] ?? run.reviewStatus}

実施内容:
- ${run.summary}

変更ファイル:
${changedFilesText}

検証結果:
${checksText}

progress.md更新:
- ${run.progressUpdated ? '更新済み' : '未更新'}

未対応・注意点:
${warningsText}

次にやるべきこと:
${nextActionsText}

Claude Codeの最終報告:
- ${run.rawReport}

確認したい観点:
- 未承認ToDoに着手していないか
- pending_approval と approved / queued が混ざっていないか
- progress.mdの既存内容を壊していないか
- buildやTypeScript確認が本当に実施されているか
- 追加でToDo化すべき問題があるか
- 次に進めるべき作業は何か`
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface Props {
  run: ExecutionRun
  onReviewStatusChange?: (runId: string, status: ReviewStatus) => void
}

export default function ExecutionRunCard({ run, onReviewStatusChange }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [showDetail, setShowDetail] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const [updating, setUpdating] = useState(false)

  async function handleCopy() {
    const text = buildReviewCopyText(run)
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 2000)

      if (run.reviewStatus === 'not_reviewed') {
        await patchReviewStatus('copied')
      }
    } catch {
      setCopyState('error')
      setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  async function patchReviewStatus(status: ReviewStatus) {
    setUpdating(true)
    try {
      await fetch(`/api/execution-runs/${run.runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: status }),
      })
      onReviewStatusChange?.(run.runId, status)
      startTransition(() => router.refresh())
    } finally {
      setUpdating(false)
    }
  }

  const checks = run.checks
  const buildOk = checks.build === 'OK'
  const tsOk = checks.typescript === 'OK'

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-blue-500 dark:text-blue-400 font-medium">{run.targetApp}</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug mt-0.5 line-clamp-2">
              {run.targetTodoTitle}
            </p>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
            {formatDateTime(run.finishedAt)}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${RUN_STATUS_COLOR[run.runStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {RUN_STATUS_LABEL[run.runStatus] ?? run.runStatus}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_COLOR[run.reviewStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {REVIEW_STATUS_LABEL[run.reviewStatus] ?? run.reviewStatus}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${buildOk ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
            build: {checks.build ?? '?'}
          </span>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tsOk ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
            TS: {checks.typescript ?? '?'}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            変更: {run.changedFiles.length}件
          </span>
          {run.warnings.length > 0 && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
              未対応: {run.warnings.length}件
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setShowDetail(true)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            詳細
          </button>
          <button
            onClick={handleCopy}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              copyState === 'copied'
                ? 'bg-green-600 text-white'
                : copyState === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {copyState === 'copied' ? 'コピー済み ✓' : copyState === 'error' ? 'コピー失敗' : 'レビュー用コピー'}
          </button>
          {run.reviewStatus !== 'reviewed' && (
            <button
              onClick={() => patchReviewStatus('reviewed')}
              disabled={updating}
              className="px-3 py-1.5 rounded-xl border border-green-300 dark:border-green-700 text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
            >
              レビュー済みにする
            </button>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} />
          <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">実行詳細</h2>
              <button
                onClick={() => setShowDetail(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm">
              <DetailRow label="対象アプリ" value={run.targetApp} />
              <DetailRow label="対象ToDo" value={run.targetTodoTitle} />
              <DetailRow label="実行ID" value={run.runId} mono />
              <DetailRow label="開始" value={new Date(run.startedAt).toLocaleString('ja-JP')} />
              <DetailRow label="終了" value={new Date(run.finishedAt).toLocaleString('ja-JP')} />
              <DetailRow label="ステータス" value={RUN_STATUS_LABEL[run.runStatus] ?? run.runStatus} />
              <DetailRow label="レビュー状態" value={REVIEW_STATUS_LABEL[run.reviewStatus] ?? run.reviewStatus} />

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">実施内容</p>
                <p className="text-gray-800 dark:text-gray-200 leading-relaxed">{run.summary}</p>
              </div>

              {run.promptUsed && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">使用プロンプト</p>
                  <p className="text-gray-700 dark:text-gray-300 text-xs leading-relaxed bg-gray-50 dark:bg-gray-800 rounded-lg p-2">{run.promptUsed}</p>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">変更ファイル ({run.changedFiles.length}件)</p>
                {run.changedFiles.length > 0 ? (
                  <ul className="space-y-1">
                    {run.changedFiles.map((f, i) => (
                      <li key={i} className="text-xs bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                        <span className="font-mono text-gray-700 dark:text-gray-300">{f.file}</span>
                        {f.change && (
                          <span className="text-gray-400 dark:text-gray-500 ml-1.5">— {f.change}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">なし</p>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">検証結果</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(run.checks).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded px-2 py-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{k}</span>
                      <span className={`text-xs font-medium ${v === 'OK' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {run.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">エラー</p>
                  <ul className="space-y-0.5">
                    {run.errors.map((e, i) => <li key={i} className="text-xs text-red-600 dark:text-red-400">{e}</li>)}
                  </ul>
                </div>
              )}

              {run.warnings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-500 mb-1">未対応・警告 ({run.warnings.length}件)</p>
                  <ul className="space-y-0.5">
                    {run.warnings.map((w, i) => <li key={i} className="text-xs text-orange-700 dark:text-orange-300">{w}</li>)}
                  </ul>
                </div>
              )}

              {run.nextActions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">次アクション</p>
                  <ul className="space-y-0.5">
                    {run.nextActions.map((a, i) => <li key={i} className="text-xs text-gray-700 dark:text-gray-300">→ {a}</li>)}
                  </ul>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">最終報告</p>
                <p className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-2 leading-relaxed whitespace-pre-wrap">{run.rawReport}</p>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={handleCopy}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    copyState === 'copied' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {copyState === 'copied' ? 'コピー済み ✓' : 'ChatGPTレビュー用テキストをコピー'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-24 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-gray-800 dark:text-gray-200 flex-1 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
