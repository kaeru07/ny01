'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { VerifyTodo, VerifyTodoStatus, VerifyTodoInput } from '@/lib/verify-todos'

const STATUS_META: Record<VerifyTodoStatus, { label: string; cls: string; chip: string }> = {
  unconfirmed: {
    label: '未確認',
    cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    chip: 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  },
  confirmed: {
    label: '確認済',
    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    chip: 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-300',
  },
  ng: {
    label: 'NG',
    cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    chip: 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300',
  },
  pending: {
    label: '保留',
    cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    chip: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  },
}

const STATUS_ORDER: VerifyTodoStatus[] = ['unconfirmed', 'ng', 'pending', 'confirmed']
const ALL = '__all__'

function inputClass(): string {
  return 'w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}

// 追加・編集フォーム（draft が無ければ新規追加、あれば編集）
function TodoForm({
  draft,
  onSaved,
  onClose,
}: {
  draft: VerifyTodo | null
  onSaved: () => void
  onClose: () => void
}) {
  const [appName, setAppName] = useState(draft?.appName ?? '')
  const [epicName, setEpicName] = useState(draft?.epicName ?? '')
  const [url, setUrl] = useState(draft?.url ?? '')
  const [steps, setSteps] = useState(draft?.steps ?? '')
  const [expectedResult, setExpectedResult] = useState(draft?.expectedResult ?? '')
  const [status, setStatus] = useState<VerifyTodoStatus>(draft?.status ?? 'unconfirmed')
  const [notes, setNotes] = useState(draft?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const payload: VerifyTodoInput = { appName, epicName, url, steps, expectedResult, status, notes }
    try {
      const res = draft
        ? await fetch(`/api/verify-todos/${encodeURIComponent(draft.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/verify-todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error || `保存に失敗しました (${res.status})`)
      }
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-900/15">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
        {draft ? '動作確認Todoを編集' : '動作確認Todoを追加'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="アプリ名">
          <input className={inputClass()} value={appName} placeholder="例: progress" onChange={(e) => setAppName(e.target.value)} />
        </Field>
        <Field label="Epic名">
          <input className={inputClass()} value={epicName} placeholder="例: epic-progress-todo" onChange={(e) => setEpicName(e.target.value)} />
        </Field>
      </div>
      <Field label="確認URL（iPhoneから押せる公開URL推奨）">
        <input className={inputClass()} inputMode="url" value={url} placeholder="example.com/path （https:// は自動補完）" onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field label="確認手順">
        <textarea className={`${inputClass()} min-h-[72px]`} value={steps} placeholder={'1. ○○を開く\n2. △△を押す'} onChange={(e) => setSteps(e.target.value)} />
      </Field>
      <Field label="期待結果">
        <textarea className={`${inputClass()} min-h-[56px]`} value={expectedResult} placeholder="○○が表示される / △△が動く" onChange={(e) => setExpectedResult(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="状態">
          <select className={inputClass()} value={status} onChange={(e) => setStatus(e.target.value as VerifyTodoStatus)}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </Field>
        <Field label="メモ（任意）">
          <input className={inputClass()} value={notes} placeholder="補足・気付き" onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

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
    </div>
  )
}

function TodoCard({
  todo,
  onEdit,
  onChanged,
}: {
  todo: VerifyTodo
  onEdit: () => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const status = STATUS_META[todo.status] ?? STATUS_META.unconfirmed

  async function setStatus(next: VerifyTodoStatus) {
    if (next === todo.status) return
    setBusy(true)
    try {
      await fetch(`/api/verify-todos/${encodeURIComponent(todo.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm('この動作確認Todoを削除しますか？')) return
    setBusy(true)
    try {
      await fetch(`/api/verify-todos/${encodeURIComponent(todo.id)}`, { method: 'DELETE' })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  const hasUrl = todo.url && todo.url !== '未確認'

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {todo.appName && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {todo.appName}
              </span>
            )}
            {todo.epicName && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                {todo.epicName}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>

      {hasUrl && (
        <a
          href={todo.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full items-center justify-between gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <span className="break-all">{todo.url}</span>
          <span className="shrink-0">開く →</span>
        </a>
      )}

      {todo.steps && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">確認手順</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{todo.steps}</p>
        </div>
      )}
      {todo.expectedResult && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">期待結果</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{todo.expectedResult}</p>
        </div>
      )}
      {todo.notes && (
        <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500 dark:border-gray-800 dark:text-gray-400">
          {todo.notes}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">状態変更:</span>
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || s === todo.status}
            onClick={() => setStatus(s)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
              s === todo.status
                ? STATUS_META[s].cls
                : `bg-transparent hover:bg-gray-50 dark:hover:bg-gray-800 ${STATUS_META[s].chip}`
            }`}
          >
            {STATUS_META[s].label}
          </button>
        ))}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onEdit}
            className="rounded-md border border-gray-300 px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            ✏️ 編集
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-md border border-red-200 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            削除
          </button>
        </span>
      </div>
    </article>
  )
}

export function VerifyTodosBoard({ initialTodos }: { initialTodos: VerifyTodo[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [appFilter, setAppFilter] = useState<string>(ALL)
  const [epicFilter, setEpicFilter] = useState<string>(ALL)
  const [statusFilter, setStatusFilter] = useState<string>(ALL)

  const todos = initialTodos

  function refresh() {
    setAdding(false)
    setEditingId(null)
    router.refresh()
  }

  const appOptions = useMemo(
    () => Array.from(new Set(todos.map((t) => t.appName).filter(Boolean))).sort(),
    [todos],
  )
  const epicOptions = useMemo(
    () => Array.from(new Set(todos.map((t) => t.epicName).filter(Boolean))).sort(),
    [todos],
  )

  const visible = useMemo(() => {
    return todos
      .filter((t) => appFilter === ALL || t.appName === appFilter)
      .filter((t) => epicFilter === ALL || t.epicName === epicFilter)
      .filter((t) => statusFilter === ALL || t.status === statusFilter)
      .sort((a, b) => {
        const d = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        if (d !== 0) return d
        return b.updatedAt.localeCompare(a.updatedAt)
      })
  }, [todos, appFilter, epicFilter, statusFilter])

  const selectCls = 'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={appFilter} onChange={(e) => setAppFilter(e.target.value)}>
          <option value={ALL}>アプリ: すべて</option>
          {appOptions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select className={selectCls} value={epicFilter} onChange={(e) => setEpicFilter(e.target.value)}>
          <option value={ALL}>Epic: すべて</option>
          {epicOptions.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value={ALL}>状態: すべて</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 dark:text-gray-500">{visible.length} 件</span>
        {!adding && !editingId && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            ＋ 動作確認Todoを追加
          </button>
        )}
      </div>

      {adding && <TodoForm draft={null} onSaved={refresh} onClose={() => setAdding(false)} />}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          該当する動作確認Todoはありません。
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((todo) =>
            editingId === todo.id ? (
              <TodoForm key={todo.id} draft={todo} onSaved={refresh} onClose={() => setEditingId(null)} />
            ) : (
              <TodoCard key={todo.id} todo={todo} onEdit={() => setEditingId(todo.id)} onChanged={refresh} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
