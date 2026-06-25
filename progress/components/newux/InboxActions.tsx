'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { InboxCard, InboxCardAction } from '@/lib/command-center'
import { KIND_CHIP_LABEL } from '@/lib/inbox-labels'
import InboxReviewCopyButton from './InboxReviewCopyButton'

// 「今日の判断」カード本体（6分類: 検収/実行許可/方針選択/人間作業/危険判断 + AI保留は非表示）。
// 社長向け: 状況見出し + ラベル付き説明行 + ボタン1つで終わり。
// 内部情報（元タイトル / runId / AI判断理由）は「詳細を見る」を押した時だけ開く。
// api: null のアクション（あとで）は状態を変えず、今日の画面から閉じるだけ。

const btn = 'rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50'
const toneClass: Record<InboxCardAction['tone'], string> = {
  primary: `${btn} bg-blue-600 text-white hover:bg-blue-700`,
  ghost: `${btn} border border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200`,
  danger: `${btn} border border-rose-200 text-rose-600 dark:border-rose-900/50`,
}

const KIND_CHIP_CLASS: Record<string, string> = {
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  acceptance: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  direction: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  permission: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  human_task: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

const FIX_PROMPT_PLACEHOLDER = [
  '例:',
  '- レビュー済みにした後も一覧に残っているので消し込みを修正',
  '- iPhone幅でボタンが折り返して見づらいので調整',
  '- completedAt が無い場合 startedAt にフォールバック',
  '- build / lint / tsc まで確認',
].join('\n')

// レビューカードの状態バッジ（未確認 / あとで / 要修正 / レビュー済み）。
const REVIEW_BADGE: Record<string, { label: string; cls: string }> = {
  not_reviewed: { label: '未確認', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  copied: { label: '未確認', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  needs_human: { label: '未確認', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  snoozed: { label: 'あとで', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  needs_followup: { label: '要修正', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  reviewed: { label: 'レビュー済み', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
}

async function callApi(api: NonNullable<InboxCardAction['api']>): Promise<void> {
  const res = await fetch(api.url, {
    method: api.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(api.body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? '処理に失敗しました')
  }
}

export default function InboxCardItem({ card, highlight = false, focusNotice = false }: { card: InboxCard; highlight?: boolean; focusNotice?: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showDetail, setShowDetail] = useState(false)
  const [closedForToday, setClosedForToday] = useState(false)
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [fixAction, setFixAction] = useState<InboxCardAction | null>(null)
  const [fixPrompt, setFixPrompt] = useState(card.fixPrompt ?? '')

  async function run(api: InboxCardAction['api']) {
    if (!api) {
      // 「あとで」(状態を変えない) は今日の画面から閉じるだけ
      setClosedForToday(true)
      return
    }
    setBusy(true)
    setError('')
    try {
      const body =
        card.kind === 'permission' &&
        selectedGoalId &&
        api.method === 'POST' &&
        api.url.includes('/approve')
          ? { ...api.body, goalId: selectedGoalId }
          : api.body
      await callApi({ ...api, body })
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '処理に失敗しました')
    } finally {
      setBusy(false)
    }
  }

  function isFixAction(action: InboxCardAction): boolean {
    return action.api?.body?.reviewStatus === 'needs_followup'
  }

  async function saveFixPrompt() {
    if (!fixAction?.api) return
    const prompt = fixPrompt.trim()
    if (!prompt) {
      setError('修正指示を入力してください')
      return
    }
    await run({ ...fixAction.api, body: { ...fixAction.api.body, fixPrompt: prompt } })
    setFixAction(null)
  }

  if (closedForToday) return null

  return (
    <li
      id={card.sourceRunId ? `review-${card.sourceRunId}` : undefined}
      className={`rounded-xl border bg-white p-4 dark:bg-gray-900 ${
        highlight
          ? 'border-blue-400 ring-2 ring-blue-400/60 dark:border-blue-500 dark:ring-blue-500/50'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {focusNotice && (
        <p className="mb-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
          次回実行予定から移動しました
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_CHIP_CLASS[card.kind]}`}>
          {KIND_CHIP_LABEL[card.kind]}
        </span>
        {card.reviewStatus && REVIEW_BADGE[card.reviewStatus] && (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${REVIEW_BADGE[card.reviewStatus].cls}`}>
            {REVIEW_BADGE[card.reviewStatus].label}
          </span>
        )}
        {card.completedAtText && (
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">完了: {card.completedAtText}</span>
        )}
      </div>
      <p className="mt-2 text-base font-bold leading-relaxed text-gray-900 dark:text-gray-100">{card.headline}</p>

      {card.rows.length > 0 && (
        <dl className="mt-2 space-y-1">
          {card.rows.map((row) => (
            <div key={row.label} className="flex gap-1.5 text-xs leading-relaxed">
              <dt className="shrink-0 font-semibold text-gray-500 dark:text-gray-400">{row.label}:</dt>
              <dd className="min-w-0 whitespace-pre-line text-gray-700 dark:text-gray-200">{row.text}</dd>
            </div>
          ))}
        </dl>
      )}

      {card.question && (
        <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{card.question}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {card.kind === 'acceptance' && card.sourceRunId && (
          <InboxReviewCopyButton runId={card.sourceRunId} />
        )}
        {card.kind === 'direction' && card.epicId && card.goals ? (
          <>
            {card.goals.map((g) => (
              <button
                key={g.id}
                disabled={busy}
                className={toneClass.ghost}
                onClick={() => run({ url: '/api/operations/epics', method: 'PATCH', body: { epicId: card.epicId, action: 'assignGoal', goalId: g.id } })}
              >
                {g.title}
              </button>
            ))}
            <button
              disabled={busy}
              className={toneClass.danger}
              onClick={() => run({ url: '/api/operations/epics', method: 'PATCH', body: { epicId: card.epicId, action: 'drop' } })}
            >
              不要
            </button>
          </>
        ) : (
          <>
            {card.kind === 'permission' && card.goals && card.goals.length > 0 && (
              <div className="w-full">
                <p className="mb-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400">目標も選ぶ（任意）</p>
                <div className="flex flex-wrap gap-2">
                  {card.goals.map((g) => (
                    <button
                      key={g.id}
                      disabled={busy}
                      className={`${btn} border ${
                        selectedGoalId === g.id
                          ? 'border-blue-600 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-200'
                          : 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200'
                      }`}
                      onClick={() => setSelectedGoalId((current) => current === g.id ? '' : g.id)}
                    >
                      {g.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {card.actions.map((action) => (
              action.href ? (
                <Link key={action.label} href={action.href} className={toneClass[action.tone]}>
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.label}
                  disabled={busy}
                  className={toneClass[action.tone]}
                  onClick={() => {
                    if (isFixAction(action)) {
                      setError('')
                      setFixAction(action)
                      setFixPrompt(card.fixPrompt ?? '')
                      return
                    }
                    run(action.api)
                  }}
                >
                  {action.label}
                </button>
              )
            ))}
          </>
        )}
      </div>

      {fixAction && (
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-900/15">
          <label className="block text-xs font-bold text-rose-700 dark:text-rose-300" htmlFor={`fix-prompt-${card.id}`}>
            修正指示を入力
          </label>
          <textarea
            id={`fix-prompt-${card.id}`}
            value={fixPrompt}
            onChange={(e) => setFixPrompt(e.target.value)}
            rows={6}
            className="mt-2 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-rose-500 dark:border-rose-900/60 dark:bg-gray-950 dark:text-gray-100"
            placeholder={FIX_PROMPT_PLACEHOLDER}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button disabled={busy} className={toneClass.danger} onClick={saveFixPrompt}>
              修正依頼として保存
            </button>
            <button
              disabled={busy}
              className={toneClass.ghost}
              onClick={() => {
                setFixAction(null)
                setError('')
                setFixPrompt(card.fixPrompt ?? '')
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <button
        className="mt-2 text-[11px] font-medium text-gray-400 underline-offset-2 hover:underline dark:text-gray-500"
        onClick={() => setShowDetail((v) => !v)}
      >
        {showDetail ? '詳細を閉じる' : '詳細を見る'}
      </button>
      {showDetail && (
        <ul className="mt-1.5 space-y-1 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
          {card.detail.map((line, i) => (
            <li key={i} className="break-all text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">・{line}</li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1.5 text-xs font-semibold text-rose-600">{error}</p>}
    </li>
  )
}
