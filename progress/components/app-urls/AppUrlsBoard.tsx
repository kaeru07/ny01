'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppUrlKind, AppUrlRecord, AppUrlStatus, EnrichedAppUrl, IphoneAccess } from '@/lib/app-urls'
import { normalizeUrlString } from '@/lib/url-normalize'

const STATUS_META: Record<AppUrlStatus, { label: string; cls: string }> = {
  active: { label: '稼働中', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  deploy_ready: { label: 'デプロイ準備', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  local_only: { label: 'ローカルのみ', cls: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  unknown: { label: '未確認', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  archived: { label: '停止', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
}

const KIND_META: Record<AppUrlKind, { label: string; cls: string }> = {
  vercel: { label: 'Vercel URL', cls: 'bg-black text-white dark:bg-white dark:text-black' },
  vps: { label: 'VPS公開URL', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  vps_internal: { label: 'VPS内部URL', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  local_dev: { label: 'Local Dev URL', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  ssh_port_forward: { label: 'SSH Port Forward URL', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  api: { label: 'API URL', cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  unknown: { label: '未確認', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
}

const CONFIDENCE_META: Record<AppUrlRecord['confidence'], { label: string; cls: string }> = {
  confirmed: { label: '確認済み', cls: 'text-green-600 dark:text-green-400' },
  documented: { label: '資料ベース', cls: 'text-amber-600 dark:text-amber-400' },
  unknown: { label: '未確認', cls: 'text-gray-400 dark:text-gray-500' },
}

const ACCESS_META: Record<IphoneAccess, { label: string; cls: string }> = {
  ok: { label: '📱 iPhone確認OK', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  blocked: { label: '🚫 iPhone直接不可', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  unknown: { label: '❔ 未確認', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
}

type FilterKey = 'all' | IphoneAccess

function UrlLink({ url }: { url: string }) {
  if (!url || url === '未確認') return <span className="text-gray-400 dark:text-gray-500">未確認</span>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="break-all font-medium text-blue-600 hover:underline dark:text-blue-400">
      {url}
    </a>
  )
}

function UrlMeta({ item }: { item: AppUrlRecord }) {
  const confidence = CONFIDENCE_META[item.confidence] ?? CONFIDENCE_META.unknown
  return (
    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
      <span className={`font-semibold ${confidence.cls}`}>{confidence.label}</span>
      {' / 根拠: '}
      {item.evidence} / {item.evidenceDetail}
      {item.lastCheckedAt ? ` / 確認日: ${item.lastCheckedAt}` : ''}
    </p>
  )
}

// iPhone から押せる代表 URL（最優先表示）
function IphonePrimaryBlock({ app }: { app: EnrichedAppUrl }) {
  if (app.iphoneAccess === 'ok' && app.iphonePrimary) {
    const item = app.iphonePrimary
    const kind = KIND_META[item.kind] ?? KIND_META.unknown
    return (
      <div className="mt-4 rounded-xl border-2 border-green-200 bg-green-50/60 p-3 dark:border-green-900/40 dark:bg-green-900/15">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-green-700 dark:text-green-300">iPhone確認URL</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind.cls}`}>{kind.label}</span>
        </div>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex w-full items-center justify-between gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
        >
          <span className="break-all">{item.url}</span>
          <span className="shrink-0">iPhoneで開く →</span>
        </a>
        <UrlMeta item={item} />
      </div>
    )
  }

  // iPhone から開ける URL が無い
  return (
    <div className="mt-4 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/40">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">iPhone確認URL</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
        {app.iphoneAccess === 'blocked' ? 'iPhone直接確認不可（内部URLのみ）' : 'iPhone直接確認不可 / URL未確認'}
      </p>
      {app.actionHint && (
        <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {app.actionHint}
        </span>
      )}
    </div>
  )
}

// localhost / 内部ポート / 未確認枠 は補助情報として折りたたみ表示
function SupplementaryUrls({ app }: { app: EnrichedAppUrl }) {
  const extraPublic = app.publicUrls.filter((u) => u !== app.iphonePrimary)
  const items: Array<{ section: string; list: AppUrlRecord[] }> = [
    { section: '他のiPhone確認URL', list: extraPublic },
    { section: 'iPhone直接不可（localhost / 内部ポート / SSH前提）', list: app.blockedUrls },
    { section: 'URL未確認枠', list: app.unknownUrls },
  ].filter((x) => x.list.length > 0)

  const total = items.reduce((sum, x) => sum + x.list.length, 0)
  if (total === 0) return null

  return (
    <details className="mt-3 rounded-xl border border-gray-100 dark:border-gray-800">
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
        補助情報: その他のURL（{total}）
      </summary>
      <div className="space-y-2 px-3 pb-3">
        {items.map((group) => (
          <div key={group.section}>
            <p className="mt-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500">{group.section}</p>
            {group.list.map((item, index) => {
              const kind = KIND_META[item.kind] ?? KIND_META.unknown
              const blocked = group.section.startsWith('iPhone直接不可')
              return (
                <div key={`${item.kind}-${item.label}-${index}`} className="mt-1 rounded-lg border border-gray-100 p-2 dark:border-gray-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind.cls}`}>{kind.label}</span>
                    {blocked && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        iPhone直接不可
                      </span>
                    )}
                    {item.label && <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>}
                  </div>
                  <div className="mt-1 text-sm"><UrlLink url={item.url} /></div>
                  <UrlMeta item={item} />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </details>
  )
}

// 編集対象の URL 行（既存メタは保持しつつ kind / label / url を編集）
type DraftUrl = Pick<AppUrlRecord, 'kind' | 'label' | 'url'> & Partial<AppUrlRecord>

const EDITABLE_KINDS: AppUrlKind[] = [
  'vercel', 'vps', 'vps_internal', 'local_dev', 'ssh_port_forward', 'api', 'unknown',
]

// URL をユーザーが手入力で編集するフォーム
function AppUrlEditor({ app, onClose }: { app: EnrichedAppUrl; onClose: () => void }) {
  const router = useRouter()
  const [rows, setRows] = useState<DraftUrl[]>(() => app.urls.map((u) => ({ ...u })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateRow(index: number, patch: Partial<DraftUrl>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, { kind: 'unknown', label: '', url: '' }])
  }
  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/app-urls/${encodeURIComponent(app.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: rows }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `保存に失敗しました (${res.status})`)
      }
      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/40 dark:bg-blue-900/15">
      <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">URLを編集</p>

      {rows.map((row, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <select
              value={row.kind}
              onChange={(e) => updateRow(i, { kind: e.target.value as AppUrlKind })}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              {EDITABLE_KINDS.map((k) => (
                <option key={k} value={k}>{KIND_META[k].label}</option>
              ))}
            </select>
            <input
              type="text"
              value={row.label}
              placeholder="ラベル（例: Vercel production）"
              onChange={(e) => updateRow(i, { label: e.target.value })}
              className="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="shrink-0 rounded-md border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
              aria-label="このURLを削除"
            >
              削除
            </button>
          </div>
          <input
            type="text"
            inputMode="url"
            value={row.url === '未確認' ? '' : row.url}
            placeholder="example.com/path （https:// は自動補完）"
            onChange={(e) => updateRow(i, { url: e.target.value })}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v) updateRow(i, { url: normalizeUrlString(v) })
            }}
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        ＋ URLを追加
      </button>

      {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          キャンセル
        </button>
      </div>
      <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        手入力したURLは「ユーザー入力」として保存され、iPhone到達性（公開URLか内部URLか）は自動で再判定されます。
      </p>
    </div>
  )
}

function AppCard({ app }: { app: EnrichedAppUrl }) {
  const status = STATUS_META[app.status] ?? STATUS_META.unknown
  const access = ACCESS_META[app.iphoneAccess]
  const [editing, setEditing] = useState(false)

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{app.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{app.purpose}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${access.cls}`}>{access.label}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${status.cls}`}>{status.label}</span>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 rounded-full border border-gray-300 px-2.5 py-1 text-[10px] font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              ✏️ URL編集
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <AppUrlEditor app={app} onClose={() => setEditing(false)} />
      ) : (
        <>
          <IphonePrimaryBlock app={app} />
          <SupplementaryUrls app={app} />
        </>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">Repo / Path</dt>
          <dd className="mt-1 break-all text-gray-700 dark:text-gray-200">{app.repoPath}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-gray-400 dark:text-gray-500">最終確認日</dt>
          <dd className="mt-1 text-gray-700 dark:text-gray-200">{app.lastCheckedAt || '未確認'}</dd>
        </div>
      </dl>

      {app.notes && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {app.notes}
        </p>
      )}
    </article>
  )
}

const FILTER_ORDER: FilterKey[] = ['all', 'ok', 'blocked', 'unknown']
const FILTER_LABEL: Record<FilterKey, string> = {
  all: 'すべて',
  ok: '📱 iPhoneで見れる',
  blocked: '🚫 直接不可',
  unknown: '❔ 未確認',
}

// iPhone確認OK → 直接不可 → 未確認 の順、同区分内は名前順
const ACCESS_SORT: Record<IphoneAccess, number> = { ok: 0, blocked: 1, unknown: 2 }

export function AppUrlsBoard({ apps }: { apps: EnrichedAppUrl[] }) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const counts = useMemo(() => {
    return {
      all: apps.length,
      ok: apps.filter((a) => a.iphoneAccess === 'ok').length,
      blocked: apps.filter((a) => a.iphoneAccess === 'blocked').length,
      unknown: apps.filter((a) => a.iphoneAccess === 'unknown').length,
    } as Record<FilterKey, number>
  }, [apps])

  const sorted = useMemo(() => {
    return [...apps].sort((a, b) => {
      const d = ACCESS_SORT[a.iphoneAccess] - ACCESS_SORT[b.iphoneAccess]
      return d !== 0 ? d : a.name.localeCompare(b.name)
    })
  }, [apps])

  const visible = filter === 'all' ? sorted : sorted.filter((a) => a.iphoneAccess === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTER_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              filter === key
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {FILTER_LABEL[key]} {counts[key]}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          該当するアプリはありません。
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((app) => <AppCard key={app.id} app={app} />)}
        </div>
      )}
    </div>
  )
}
