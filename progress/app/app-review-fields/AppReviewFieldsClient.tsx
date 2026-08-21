'use client'

import { useMemo, useState } from 'react'

import CopyButton from '../ios-signing-guide/CopyButton'
import { buildAppReviewCopyText } from '@/lib/app-review-copy'
import { APP_REVIEW_GROUPS } from '@/lib/app-review-groups'
import type { AppReviewApp, AppReviewField, AppReviewFieldKey } from '@/lib/app-review-fields'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface AppCardState {
  /** 入力欄の現在値（key → 値）。 */
  values: Record<AppReviewFieldKey, string>
  /** 直近保存時点の値。未保存バッジの判定に使う。 */
  baseline: Record<AppReviewFieldKey, string>
  saveState: SaveState
  errorMessage: string
  savedAt: string | null
}

function toValueMap(fields: AppReviewField[]): Record<AppReviewFieldKey, string> {
  const map = {} as Record<AppReviewFieldKey, string>
  for (const field of fields) map[field.key] = field.value
  return map
}

function initialState(apps: AppReviewApp[]): Record<string, AppCardState> {
  const state: Record<string, AppCardState> = {}
  for (const app of apps) {
    const values = toValueMap(app.fields)
    state[app.bundleId] = {
      values,
      baseline: { ...values },
      saveState: 'idle',
      errorMessage: '',
      savedAt: app.savedAt,
    }
  }
  return state
}

function formatSavedAt(iso: string | null): string {
  if (!iso) return '未保存'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '未保存'
  return `保存済み ${date.toLocaleString('ja-JP', { hour12: false })}`
}

function SourceBadge({ field, value }: { field: AppReviewField; value: string }) {
  const trimmed = value.trim()
  if (!trimmed) {
    return <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-black text-gray-500 dark:bg-gray-800 dark:text-gray-400">未入力</span>
  }
  if (trimmed === field.autoValue.trim()) {
    return <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-black text-gray-500 dark:bg-gray-800 dark:text-gray-400">自動</span>
  }
  return <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-black text-blue-700 dark:bg-blue-950 dark:text-blue-200">入力値</span>
}

export default function AppReviewFieldsClient({ apps }: { apps: AppReviewApp[] }) {
  const [state, setState] = useState<Record<string, AppCardState>>(() => initialState(apps))

  function setValue(bundleId: string, key: AppReviewFieldKey, value: string) {
    setState((prev) => {
      const card = prev[bundleId]
      if (!card) return prev
      return {
        ...prev,
        [bundleId]: { ...card, values: { ...card.values, [key]: value }, saveState: 'idle', errorMessage: '' },
      }
    })
  }

  async function save(app: AppReviewApp) {
    const card = state[app.bundleId]
    if (!card) return
    setState((prev) => ({ ...prev, [app.bundleId]: { ...prev[app.bundleId], saveState: 'saving', errorMessage: '' } }))

    try {
      // 自動既定値と同じ項目は保存しない（空文字で送る＝保存値を消す）。
      // fastlane 側を更新したときに、画面から入れた同一文字列が固定化しないようにするため。
      const payload: Record<string, string> = {}
      for (const field of app.fields) {
        const value = card.values[field.key] ?? ''
        payload[field.key] = value.trim() === field.autoValue.trim() ? '' : value
      }

      const res = await fetch('/api/app-review-fields', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: app.bundleId, fields: payload }),
      })
      const json = (await res.json()) as { success?: boolean; app?: AppReviewApp; error?: string }
      if (!res.ok || !json.success || !json.app) throw new Error(json.error ?? '保存に失敗しました')

      const savedValues = toValueMap(json.app.fields)
      setState((prev) => ({
        ...prev,
        [app.bundleId]: {
          values: savedValues,
          baseline: { ...savedValues },
          saveState: 'saved',
          errorMessage: '',
          savedAt: json.app!.savedAt,
        },
      }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        [app.bundleId]: { ...prev[app.bundleId], saveState: 'error', errorMessage: (err as Error).message },
      }))
    }
  }

  function resetToAuto(app: AppReviewApp, key: AppReviewFieldKey) {
    const field = app.fields.find((item) => item.key === key)
    if (!field) return
    setValue(app.bundleId, key, field.autoValue)
  }

  return (
    <section className="space-y-4">
      {apps.map((app) => {
        const card = state[app.bundleId]
        if (!card) return null
        const dirty = app.fields.some((field) => (card.values[field.key] ?? '') !== (card.baseline[field.key] ?? ''))
        // 並びは App Store Connect の入力順（APP_REVIEW_GROUPS）に固定する。
        const groups = APP_REVIEW_GROUPS.filter((group) => app.fields.some((field) => field.group === group.name))
        const copyText = buildAppReviewCopyText(app, app.fields.map((field) => ({ label: field.label, value: card.values[field.key] ?? '' })))

        return (
          <details key={app.bundleId} className="rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-black text-gray-900 dark:text-gray-100">
              {app.appName}
              {dirty ? <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800 dark:bg-amber-950 dark:text-amber-200">未保存</span> : null}
            </summary>

            <div className="space-y-4 border-t border-gray-200 p-4 dark:border-gray-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{app.appPathLabel}</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-gray-500 dark:text-gray-400">{app.bundleId}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-gray-500 dark:text-gray-400">{formatSavedAt(card.savedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={copyText} label="この審査項目を全文コピー" />
                  <button
                    type="button"
                    onClick={() => save(app)}
                    disabled={card.saveState === 'saving'}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-black text-white disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900"
                  >
                    {card.saveState === 'saving' ? '保存中…' : card.saveState === 'saved' && !dirty ? '保存しました' : '保存'}
                  </button>
                </div>
              </div>

              {card.saveState === 'error' ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700 dark:bg-red-950/40 dark:text-red-200">{card.errorMessage}</p>
              ) : null}

              {!app.hasMetadata ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  fastlane/metadata が未整備のアプリです。自動で入る値が少ないため、この画面で直接入力して保存してください。
                </p>
              ) : null}

              {groups.map((group) => (
                <section key={group.name} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">{group.name}</h3>
                  {group.note ? (
                    <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-gray-600 dark:bg-gray-900 dark:text-gray-300">{group.note}</p>
                  ) : null}
                  <div className="mt-3 space-y-4">
                    {app.fields.filter((field) => field.group === group.name).map((field) => {
                      const value = card.values[field.key] ?? ''
                      const canReset = field.autoValue.trim() !== '' && value.trim() !== field.autoValue.trim()
                      const over = field.maxLength !== undefined && value.length > field.maxLength
                      return (
                        <div key={field.key} className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor={`${app.id}-${field.key}`} className="text-xs font-black text-gray-500 dark:text-gray-400">{field.label}</label>
                            <SourceBadge field={field} value={value} />
                            {field.maxLength !== undefined ? (
                              <span className={over ? 'rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:bg-red-950 dark:text-red-200' : 'text-[10px] font-black text-gray-400 dark:text-gray-500'}>
                                {value.length} / {field.maxLength}
                              </span>
                            ) : null}
                            {canReset ? (
                              <button
                                type="button"
                                onClick={() => resetToAuto(app, field.key)}
                                className="rounded-md border border-gray-300 px-1.5 py-0.5 text-[10px] font-black text-gray-600 dark:border-gray-700 dark:text-gray-300"
                              >
                                自動値に戻す
                              </button>
                            ) : null}
                          </div>
                          <div className="flex items-start gap-2">
                            {field.multiline ? (
                              <textarea
                                id={`${app.id}-${field.key}`}
                                value={value}
                                onChange={(event) => setValue(app.bundleId, field.key, event.target.value)}
                                placeholder={field.placeholder}
                                rows={3}
                                className={`min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 font-mono text-xs font-bold text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${over ? 'border-red-400 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'}`}
                              />
                            ) : (
                              <input
                                id={`${app.id}-${field.key}`}
                                type="text"
                                value={value}
                                onChange={(event) => setValue(app.bundleId, field.key, event.target.value)}
                                placeholder={field.placeholder}
                                className={`min-w-0 flex-1 rounded-xl border bg-white px-3 py-2 font-mono text-xs font-bold text-gray-900 dark:bg-gray-900 dark:text-gray-100 ${over ? 'border-red-400 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'}`}
                              />
                            )}
                            <CopyButton text={value} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}

              <details className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                <summary className="cursor-pointer select-none text-sm font-black text-gray-900 dark:text-gray-100">全文プレビュー</summary>
                <div className="mt-3 flex justify-end">
                  <CopyButton text={copyText} label="全文をコピー" />
                </div>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-gray-950 p-3 font-mono text-[11px] leading-relaxed text-gray-100">{copyText}</pre>
              </details>
            </div>
          </details>
        )
      })}
    </section>
  )
}
