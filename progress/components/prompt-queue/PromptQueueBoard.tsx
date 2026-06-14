'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { copyTextToClipboard } from '@/lib/clipboard'
import type { PromptQueueCandidate, PromptQueueItem, PromptQueueStatus } from '@/types/prompt-queue'

interface Option {
  id: string
  name: string
}

interface GoalOption {
  id: string
  title: string
}

interface Props {
  items: PromptQueueItem[]
  nextCandidates: PromptQueueCandidate[]
  projects: Option[]
  goals: GoalOption[]
}

const STATUS_LABEL: Record<PromptQueueStatus, string> = {
  queued: '待機中',
  reserved: '予約済み',
  not_started: '未着手',
  running: '実行中',
  completed: '完了',
  failed: '失敗',
  needs_retry: '再試行',
  needs_user_prompt_fix: '指示修正待ち',
  needs_review: 'レビュー待ち',
  canceled: 'キャンセル',
  snoozed: '後回し',
  archived: 'アーカイブ',
}

const STATUS_CLASS: Record<PromptQueueStatus, string> = {
  queued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  reserved: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  needs_retry: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  needs_user_prompt_fix: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  needs_review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  canceled: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  snoozed: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  archived: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
}

const SAMPLE_JSON = `{
  "promptQueue": [
    {
      "title": "Inboxのレビュー導線を確認する",
      "prompt": "司令塔トップから /decide?tab=review&goalId=...&focusRunId=... へ移動し、該当レビューがハイライトされることを確認してください。問題があれば最小差分で修正し、npx tsc --noEmit / npm run lint / npm run build を実行してください。",
      "project": "progress",
      "goalProgress": "AI工場",
      "notes": "priorityやassigneeが入っていてもPrompt Queueでは無視されます"
    }
  ]
}`

function fieldClass(): string {
  return 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'
}

function fmt(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  )
}

function PromptQueueForm({ projects, goals, onSaved }: { projects: Option[]; goals: GoalOption[]; onSaved: () => void }) {
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [projectId, setProjectId] = useState('')
  const [goalProgressId, setGoalProgressId] = useState('')
  const [notes, setNotes] = useState('')
  const [relatedUrl, setRelatedUrl] = useState('')
  const [relatedReviewId, setRelatedReviewId] = useState('')
  const [relatedInboxId, setRelatedInboxId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!title.trim() || !prompt.trim() || !projectId || !goalProgressId) {
      setError('タスク名 / プロンプト / Project / Goal進捗 は必須です')
      return
    }
    const project = projects.find((p) => p.id === projectId)
    const goal = goals.find((g) => g.id === goalProgressId)
    setSaving(true)
    try {
      const res = await fetch('/api/prompt-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          prompt,
          projectId,
          projectName: project?.name,
          goalProgressId,
          goalProgressTitle: goal?.title,
          notes,
          relatedUrl,
          relatedReviewId,
          relatedInboxId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '保存に失敗しました')
      }
      setTitle('')
      setPrompt('')
      setProjectId('')
      setGoalProgressId('')
      setNotes('')
      setRelatedUrl('')
      setRelatedReviewId('')
      setRelatedInboxId('')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">作業プロンプトを追加</h2>
      <div className="mt-3 space-y-3">
        <Field label="タスク名">
          <input className={fieldClass()} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: Inboxレビュー導線の確認" />
        </Field>
        <Field label="プロンプト">
          <textarea className={`${fieldClass()} min-h-[132px]`} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="作業指示をそのまま貼り付けます" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project">
            <select className={fieldClass()} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Projectを選択</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Goal進捗">
            <select className={fieldClass()} value={goalProgressId} onChange={(e) => setGoalProgressId(e.target.value)}>
              <option value="">Goal進捗を選択</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>{goal.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <details className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800">
          <summary className="cursor-pointer text-xs font-bold text-gray-500 dark:text-gray-400">任意項目</summary>
          <div className="mt-3 space-y-3">
            <Field label="メモ">
              <input className={fieldClass()} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="補足" />
            </Field>
            <Field label="関連URL">
              <input className={fieldClass()} value={relatedUrl} onChange={(e) => setRelatedUrl(e.target.value)} placeholder="https://..." />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="関連レビューID">
                <input className={fieldClass()} value={relatedReviewId} onChange={(e) => setRelatedReviewId(e.target.value)} />
              </Field>
              <Field label="関連Inbox ID">
                <input className={fieldClass()} value={relatedInboxId} onChange={(e) => setRelatedInboxId(e.target.value)} />
              </Field>
            </div>
          </div>
        </details>
        {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中' : 'Prompt Queueに追加'}
        </button>
      </div>
    </section>
  )
}

function JsonImportBox({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ imported: number; warnings: string[]; errors: string[] } | null>(null)

  async function importJson() {
    setResult(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (err) {
      setResult({ imported: 0, warnings: [], errors: [`JSONパースエラー: ${err instanceof Error ? err.message : 'invalid json'}`] })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/prompt-queue/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      const data = await res.json().catch(() => ({}))
      setResult({
        imported: data.imported ?? 0,
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        errors: Array.isArray(data.errors) ? data.errors : data.error ? [data.error] : [],
      })
      if (res.ok && (data.imported ?? 0) > 0) {
        setText('')
        onImported()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">JSON一括取り込み</h2>
        <button type="button" onClick={() => setText(SAMPLE_JSON)} className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400">
          サンプルを入れる
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {"{ \"promptQueue\": [...] }"} または旧互換 {"{ \"todos\": [...] }"} を貼り付けます。priority / assignee / preferredExecutor は無視します。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={9}
        className="mt-3 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
        placeholder={'{\n  "promptQueue": [\n    { "title": "", "prompt": "", "project": "", "goalProgress": "" }\n  ]\n}'}
      />
      <button
        type="button"
        onClick={importJson}
        disabled={!text.trim() || saving}
        className="mt-3 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
      >
        {saving ? '取り込み中' : 'JSONを取り込む'}
      </button>
      {result && (
        <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800/60">
          <p className="font-bold text-gray-900 dark:text-gray-100">取り込み {result.imported}件</p>
          {result.warnings.map((warning, index) => (
            <p key={`w-${index}`} className="text-amber-700 dark:text-amber-300">警告: {warning}</p>
          ))}
          {result.errors.map((error, index) => (
            <p key={`e-${index}`} className="text-red-600 dark:text-red-400">エラー: {error}</p>
          ))}
        </div>
      )}
    </section>
  )
}

function PromptQueueCard({ item, candidate, onChanged }: { item: PromptQueueItem; candidate?: PromptQueueCandidate; onChanged: () => void }) {
  const [openPrompt, setOpenPrompt] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function setStatus(status: PromptQueueStatus) {
    setBusy(true)
    try {
      await fetch(`/api/prompt-queue/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      onChanged()
    } finally {
      setBusy(false)
    }
  }

  async function copyPrompt() {
    const ok = await copyTextToClipboard(item.prompt)
    setCopied(ok)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-gray-900 dark:text-gray-100">{item.title}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Project: {item.projectName ?? item.projectId ?? '未紐付け'} / Goal進捗: {item.goalProgressTitle ?? item.goalProgressId ?? '未紐付け'}
          </p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[item.status]}`}>{STATUS_LABEL[item.status]}</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-gray-500 dark:text-gray-400 sm:grid-cols-2">
        <p>作成: {fmt(item.createdAt)}</p>
        <p>更新: {fmt(item.updatedAt)}</p>
      </div>
      {candidate && (
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 dark:bg-blue-900/20 dark:text-blue-200">
          次回やる候補 #{candidate.candidateOrder}: {candidate.candidateReason}
        </p>
      )}
      {item.notes && <p className="mt-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">{item.notes}</p>}
      {openPrompt && (
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:bg-gray-950 dark:text-gray-100">
          {item.prompt}
        </pre>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpenPrompt((value) => !value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
          {openPrompt ? 'プロンプトを閉じる' : 'プロンプト確認'}
        </button>
        <button type="button" onClick={copyPrompt} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-bold text-blue-700 dark:border-blue-900/60 dark:text-blue-300">
          {copied ? 'コピー済み' : 'コピー'}
        </button>
        <button type="button" disabled={busy} onClick={() => setStatus('snoozed')} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
          後回し
        </button>
        <button type="button" disabled={busy} onClick={() => setStatus('canceled')} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400">
          キャンセル
        </button>
        <button type="button" disabled={busy} onClick={() => setStatus('completed')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          完了扱い
        </button>
      </div>
    </article>
  )
}

export function PromptQueueBoard({ items, nextCandidates, projects, goals }: Props) {
  const router = useRouter()
  const candidateById = useMemo(() => new Map(nextCandidates.map((candidate) => [candidate.id, candidate])), [nextCandidates])
  const visibleItems = useMemo(
    () => [...items].filter((item) => item.status !== 'archived').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [items],
  )

  function refresh() {
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <PromptQueueForm projects={projects} goals={goals} onSaved={refresh} />
      <JsonImportBox onImported={refresh} />

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/15">
        <h2 className="text-sm font-bold text-blue-900 dark:text-blue-100">次回やる候補</h2>
        {nextCandidates.length === 0 ? (
          <p className="mt-2 text-sm text-blue-800/80 dark:text-blue-200/80">候補はありません。</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {nextCandidates.map((candidate) => (
              <li key={candidate.id} className="rounded-lg bg-white px-3 py-2 dark:bg-gray-900">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">#{candidate.candidateOrder} {candidate.title}</p>
                <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">{candidate.candidateReason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Prompt Queue一覧</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{visibleItems.length}件</p>
        </div>
        {visibleItems.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
            作業プロンプトはまだありません。
          </p>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item) => (
              <PromptQueueCard key={item.id} item={item} candidate={candidateById.get(item.id)} onChanged={refresh} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
