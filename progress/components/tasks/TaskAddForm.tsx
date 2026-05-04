'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { TaskStatus, TaskPriority, TaskAssignee } from '@/types/progress'

interface TaskAddFormProps {
  projectId?: string
  projects?: { id: string; name: string }[]
  autoOpen?: boolean
  onCreated?: () => void
  onCancel?: () => void
}

export default function TaskAddForm({
  projectId: initialProjectId,
  projects,
  autoOpen,
  onCreated,
  onCancel,
}: TaskAddFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(autoOpen ?? false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(
    initialProjectId ?? projects?.[0]?.id ?? ''
  )
  const projectId = initialProjectId ?? selectedProjectId

  const [form, setForm] = useState({
    title: '',
    status: 'todo' as TaskStatus,
    priority: 'medium' as TaskPriority,
    risk: '',
    assignee: 'claude' as TaskAssignee,
    targetApp: '',
    targetPath: '',
    memo: '',
    taskPrompt: '',
    doneCriteria: '',
    allowed: '',
    forbidden: '',
    blockedReason: '',
    unblockAction: '',
    nextQuestion: '',
  })

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function resetForm() {
    setForm({
      title: '',
      status: 'todo',
      priority: 'medium',
      risk: '',
      assignee: 'claude',
      targetApp: '',
      targetPath: '',
      memo: '',
      taskPrompt: '',
      doneCriteria: '',
      allowed: '',
      forbidden: '',
      blockedReason: '',
      unblockAction: '',
      nextQuestion: '',
    })
  }

  function splitLines(text: string): string[] {
    return text.split('\n').map((s) => s.trim()).filter(Boolean)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!projectId) { setError('案件を選択してください'); return }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: form.title.trim(),
          status: form.status,
          priority: form.priority,
          assignee: form.assignee,
          memo: form.memo.trim(),
          ...(form.risk && { risk: form.risk }),
          ...(form.targetApp.trim() && { targetApp: form.targetApp.trim() }),
          ...(form.targetPath.trim() && { targetPath: form.targetPath.trim() }),
          ...(form.taskPrompt.trim() && { taskPrompt: form.taskPrompt.trim() }),
          ...(form.doneCriteria.trim() && { doneCriteria: splitLines(form.doneCriteria) }),
          ...(form.allowed.trim() && { allowed: splitLines(form.allowed) }),
          ...(form.forbidden.trim() && { forbidden: splitLines(form.forbidden) }),
          ...(form.blockedReason.trim() && { blockedReason: form.blockedReason.trim() }),
          ...(form.unblockAction.trim() && { unblockAction: form.unblockAction.trim() }),
          ...(form.nextQuestion.trim() && { nextQuestion: form.nextQuestion.trim() }),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? '追加に失敗しました')
      }
      resetForm()
      setOpen(false)
      router.refresh()
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'タスクの追加に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setOpen(false)
    setError('')
    onCancel?.()
  }

  if (!open) {
    // 親が onCancel で開閉を制御している場合は何も表示しない
    if (onCancel !== undefined) return null

    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
      >
        <span className="text-lg leading-none">+</span>
        タスクを追加
      </button>
    )
  }

  const inputBase =
    'w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100'
  const inputSm =
    'w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400'
  const lbl = 'block text-xs text-gray-500 dark:text-gray-400 mb-1'

  return (
    <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/10 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">新しいタスク</h3>
        <button
          type="button"
          onClick={handleCancel}
          aria-label="閉じる"
          className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Project selector */}
      {!initialProjectId && projects && projects.length > 0 && (
        <div className="mb-3">
          <label className={lbl}>案件 *</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className={inputBase}
            required
          >
            <option value="">案件を選択...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Title */}
        <input
          type="text"
          placeholder="タスク名 *"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className={inputBase}
          required
        />

        {/* targetApp + targetPath */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={lbl}>対象アプリ</label>
            <input
              type="text"
              placeholder="例: ny01/progress"
              value={form.targetApp}
              onChange={(e) => set('targetApp', e.target.value)}
              className={inputBase}
            />
          </div>
          <div>
            <label className={lbl}>対象パス</label>
            <input
              type="text"
              placeholder="例: app/tasks/page.tsx"
              value={form.targetPath}
              onChange={(e) => set('targetPath', e.target.value)}
              className={inputBase}
            />
          </div>
        </div>

        {/* status + priority + risk */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={lbl}>ステータス</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as TaskStatus)}
              className={inputBase}
            >
              <option value="todo">TODO</option>
              <option value="in_progress">進行中</option>
              <option value="impl_done">実装完了</option>
              <option value="local_done">ローカル確認済</option>
              <option value="blocked">ブロック</option>
              <option value="backlog">Backlog</option>
              <option value="done">完了</option>
            </select>
          </div>
          <div>
            <label className={lbl}>優先度</label>
            <select
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as TaskPriority)}
              className={inputBase}
            >
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div>
            <label className={lbl}>リスク</label>
            <select
              value={form.risk}
              onChange={(e) => set('risk', e.target.value)}
              className={inputBase}
            >
              <option value="">未設定</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
        </div>

        {/* Assignee */}
        <div>
          <label className={lbl}>担当</label>
          <select
            value={form.assignee}
            onChange={(e) => set('assignee', e.target.value as TaskAssignee)}
            className={inputBase}
          >
            <option value="claude">Claude</option>
            <option value="user">ユーザー</option>
            <option value="both">両者</option>
          </select>
        </div>

        {/* Memo / 作業内容 */}
        <div>
          <label className={lbl}>作業内容（任意）</label>
          <textarea
            placeholder="何をやるか・背景・注意点"
            value={form.memo}
            onChange={(e) => set('memo', e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 resize-none"
          />
        </div>

        {/* Detail fields */}
        <details className="group">
          <summary className="text-xs text-blue-500 dark:text-blue-400 cursor-pointer select-none hover:text-blue-700 dark:hover:text-blue-300 py-0.5">
            ▶ 詳細項目（taskPrompt・完了条件・許可/禁止・blocked理由 等）
          </summary>
          <div className="space-y-3 mt-3 pt-3 border-t border-blue-100 dark:border-blue-900/40">
            <div>
              <label className={lbl}>
                作業指示プロンプト <span className="text-violet-500">（Claude Codeへの専用指示）</span>
              </label>
              <textarea
                value={form.taskPrompt}
                onChange={(e) => set('taskPrompt', e.target.value)}
                placeholder="このToDoでClaude Codeに特に守ってほしいこと、作業手順、注意点"
                rows={3}
                className="w-full rounded-lg border border-violet-200 dark:border-violet-700 px-3 py-2 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
              />
            </div>
            <div>
              <label className={lbl}>完了条件（1行1件）</label>
              <textarea
                value={form.doneCriteria}
                onChange={(e) => set('doneCriteria', e.target.value)}
                placeholder={"build成功\nTypeScriptエラーが0件"}
                rows={2}
                className={`${inputSm} resize-none`}
              />
            </div>
            <div>
              <label className={lbl}>許可事項（1行1件）</label>
              <textarea
                value={form.allowed}
                onChange={(e) => set('allowed', e.target.value)}
                placeholder="UIコンポーネントの修正"
                rows={2}
                className={`${inputSm} resize-none`}
              />
            </div>
            <div>
              <label className={lbl}>禁止事項（1行1件）</label>
              <textarea
                value={form.forbidden}
                onChange={(e) => set('forbidden', e.target.value)}
                placeholder={"データ削除\n外部API追加"}
                rows={2}
                className={`${inputSm} resize-none`}
              />
            </div>
            <div>
              <label className={lbl}>blocked理由</label>
              <textarea
                value={form.blockedReason}
                onChange={(e) => set('blockedReason', e.target.value)}
                placeholder="環境変数が未設定のため"
                rows={2}
                className={`${inputSm} resize-none`}
              />
            </div>
            <div>
              <label className={lbl}>解除方法</label>
              <input
                type="text"
                value={form.unblockAction}
                onChange={(e) => set('unblockAction', e.target.value)}
                placeholder=".env.localにSUPABASE_URLを設定する"
                className={inputSm}
              />
            </div>
            <div>
              <label className={lbl}>次の質問</label>
              <input
                type="text"
                value={form.nextQuestion}
                onChange={(e) => set('nextQuestion', e.target.value)}
                placeholder="デプロイ先のURLを確認してください"
                className={inputSm}
              />
            </div>
          </div>
        </details>

        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading || !form.title.trim()}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? '追加中...' : '追加'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
          >
            キャンセル
          </button>
        </div>

        {/* JSON bulk import link */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-500 pt-1">
          複数件まとめて追加するには{' '}
          <Link href="/tasks/import" className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 underline">
            JSON取り込み
          </Link>{' '}
          を使ってください
        </p>
      </form>
    </div>
  )
}
