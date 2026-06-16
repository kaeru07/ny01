'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StatusBadge, PriorityBadge } from '@/components/tasks/TaskBadge'
import { getAssigneeColor, getAssigneeLabel, getStatusColor, getPriorityColor } from '@/lib/progress-transform'
import TaskPromptEditor from '@/components/tasks/TaskPromptEditor'
import type { TaskStatus, TaskPriority, TaskAssignee } from '@/types/progress'

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'pending_approval', label: '承認待ち' },
  { value: 'todo', label: 'TODO' },
  { value: 'in_progress', label: '進行中' },
  { value: 'impl_done', label: '実装完了' },
  { value: 'local_done', label: 'ローカル確認済' },
  { value: 'blocked', label: 'ブロック' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'done', label: '完了' },
  { value: 'skipped', label: 'スキップ' },
  { value: 'deleted', label: '削除済み' },
]

const PRIORITY_OPTIONS_EDIT: { value: TaskPriority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const ASSIGNEE_OPTIONS_EDIT: { value: TaskAssignee; label: string }[] = [
  { value: 'claude', label: 'Claude' },
  { value: 'user', label: 'ユーザー' },
  { value: 'both', label: '両者' },
]

export interface TodoTask {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: TaskAssignee
  memo: string
  taskPrompt?: string
  projectId: string
  projectName: string
  updatedAt: string
  doneCriteria?: string[]
  allowed?: string[]
  forbidden?: string[]
  risk?: string
  blockedReason?: string
  unblockAction?: string
  nextQuestion?: string
  targetPath?: string
  targetApp?: string
}

interface Props {
  tasks: TodoTask[]
  projects: { id: string; name: string }[]
  queuedTaskIds: string[]
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'pending_approval', label: '承認待ち' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'TODO' },
  { value: 'in_progress', label: '進行中' },
  { value: 'impl_done', label: '実装完了' },
  { value: 'local_done', label: 'ローカル確認済' },
  { value: 'blocked', label: 'ブロック' },
  { value: 'done', label: '完了' },
  { value: 'skipped', label: 'スキップ' },
  { value: 'deleted', label: '削除済み' },
]

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const ASSIGNEE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'claude', label: 'Claude' },
  { value: 'user', label: 'ユーザー' },
  { value: 'both', label: '両者' },
]

interface EditForm {
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignee: TaskAssignee
  memo: string
  taskPrompt: string
  doneCriteria: string
  allowed: string
  forbidden: string
  risk: string
  blockedReason: string
  unblockAction: string
  nextQuestion: string
  targetPath: string
  targetApp: string
}

function baseChipClass(active: boolean): string {
  return `px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
    active
      ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`
}

function priorityChipClass(value: string, active: boolean): string {
  if (!active) return 'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  const map: Record<string, string> = {
    '': 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900',
    high: 'bg-red-600 text-white',
    medium: 'bg-amber-500 text-white',
    low: 'bg-emerald-600 text-white',
  }
  return `px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${map[value] ?? 'bg-gray-800 text-white'}`
}

function statusChipClass(value: string, active: boolean): string {
  if (!active) return 'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
  const map: Record<string, string> = {
    '': 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900',
    pending_approval: 'bg-amber-600 text-white',
    backlog: 'bg-slate-500 text-white',
    todo: 'bg-gray-600 text-white',
    in_progress: 'bg-blue-600 text-white',
    impl_done: 'bg-indigo-600 text-white',
    local_done: 'bg-teal-600 text-white',
    blocked: 'bg-red-600 text-white',
    done: 'bg-green-600 text-white',
    skipped: 'bg-gray-500 text-white',
    deleted: 'bg-gray-500 text-white',
  }
  return `px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${map[value] ?? 'bg-gray-800 text-white'}`
}

function formatShortDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function TodoManager({ tasks, projects, queuedTaskIds }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [viewMode, setViewMode] = useState<'active' | 'archive'>('active')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set())
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set(queuedTaskIds))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForms, setEditForms] = useState<Record<string, EditForm>>({})
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set())
  const [saveResults, setSaveResults] = useState<Record<string, 'ok' | string>>({})
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  async function copyPrompt(taskId: string, prompt: string) {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      // fallback: no-op (TaskPromptEditor handles manual copy)
    }
    setCopiedPromptId(taskId)
    setTimeout(() => setCopiedPromptId((id) => (id === taskId ? null : id)), 2000)
  }

  const archiveStatuses = useMemo(() => new Set<TaskStatus>(['done', 'skipped', 'deleted']), [])

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const isArchive = archiveStatuses.has(t.status)
      if (viewMode === 'active' && isArchive) return false
      if (viewMode === 'archive' && !isArchive) return false
      if (projectFilter && t.projectId !== projectFilter) return false
      if (statusFilter && t.status !== statusFilter) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (assigneeFilter && t.assignee !== assigneeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.projectName.toLowerCase().includes(q) && !t.memo.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tasks, archiveStatuses, viewMode, projectFilter, statusFilter, priorityFilter, assigneeFilter, search])

  function startEdit(task: TodoTask) {
    setEditForms((prev) => ({
      ...prev,
      [task.id]: {
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
        memo: task.memo,
        taskPrompt: task.taskPrompt ?? '',
        doneCriteria: (task.doneCriteria ?? []).join('\n'),
        allowed: (task.allowed ?? []).join('\n'),
        forbidden: (task.forbidden ?? []).join('\n'),
        risk: task.risk ?? '',
        blockedReason: task.blockedReason ?? '',
        unblockAction: task.unblockAction ?? '',
        nextQuestion: task.nextQuestion ?? '',
        targetPath: task.targetPath ?? '',
        targetApp: task.targetApp ?? '',
      },
    }))
    setEditingId(task.id)
    setSaveResults((prev) => { const n = { ...prev }; delete n[task.id]; return n })
  }

  function cancelEdit(taskId: string) {
    setEditingId(null)
    setEditForms((prev) => { const n = { ...prev }; delete n[taskId]; return n })
    setSaveResults((prev) => { const n = { ...prev }; delete n[taskId]; return n })
  }

  async function saveEdit(task: TodoTask) {
    const form = editForms[task.id]
    if (!form) return
    setSavingIds((prev) => new Set(Array.from(prev).concat(task.id)))
    setSaveResults((prev) => { const n = { ...prev }; delete n[task.id]; return n })

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: task.projectId,
        fullUpdate: true,
        title: form.title,
        status: form.status,
        priority: form.priority,
        assignee: form.assignee,
        memo: form.memo,
        taskPrompt: form.taskPrompt,
        doneCriteria: form.doneCriteria.split('\n').map(s => s.trim()).filter(Boolean),
        allowed: form.allowed.split('\n').map(s => s.trim()).filter(Boolean),
        forbidden: form.forbidden.split('\n').map(s => s.trim()).filter(Boolean),
        risk: form.risk,
        blockedReason: form.blockedReason,
        unblockAction: form.unblockAction,
        nextQuestion: form.nextQuestion,
        targetPath: form.targetPath,
        targetApp: form.targetApp,
      }),
    })

    setSavingIds((prev) => { const n = new Set(Array.from(prev)); n.delete(task.id); return n })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setSaveResults((prev) => ({ ...prev, [task.id]: data.error ?? '保存失敗' }))
      return
    }

    setSaveResults((prev) => ({ ...prev, [task.id]: 'ok' }))
    setEditingId(null)
    setEditForms((prev) => { const n = { ...prev }; delete n[task.id]; return n })
    startTransition(() => router.refresh())
  }

  async function addToQueue(task: TodoTask) {
    setAddingIds((prev) => new Set(Array.from(prev).concat(task.id)))
    setErrors((prev) => { const n = { ...prev }; delete n[task.id]; return n })

    const res = await fetch('/api/queue/add-from-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: task.projectId, taskId: task.id }),
    })

    setAddingIds((prev) => { const n = new Set(Array.from(prev)); n.delete(task.id); return n })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setErrors((prev) => ({ ...prev, [task.id]: data.error ?? '追加失敗' }))
      return
    }

    setAddedIds((prev) => new Set(Array.from(prev).concat(task.id)))
    startTransition(() => router.refresh())
  }

  async function deleteTask(task: TodoTask) {
    if (!window.confirm(`「${task.title}」を削除しますか？\nこの操作は取り消せません。`)) return
    setDeletingIds((prev) => new Set(Array.from(prev).concat(task.id)))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: task.projectId, status: 'deleted' }),
    })
    setDeletingIds((prev) => { const n = new Set(Array.from(prev)); n.delete(task.id); return n })
    if (res.ok) startTransition(() => router.refresh())
  }

  function resetFilters() {
    setProjectFilter('')
    setStatusFilter('')
    setPriorityFilter('')
    setAssigneeFilter('')
    setSearch('')
  }

  const activeFilterCount = [projectFilter, statusFilter, priorityFilter, assigneeFilter, search].filter(Boolean).length

  const counts = useMemo(() => {
    const c = { pendingApproval: 0, today: 0, normal: 0, blocked: 0, archive: 0 }
    for (const t of tasks) {
      if (archiveStatuses.has(t.status)) c.archive++
      else if (addedIds.has(t.id)) c.today++
      else if (t.status === 'pending_approval') c.pendingApproval++
      else if (t.status === 'blocked') c.blocked++
      else c.normal++
    }
    return c
  }, [tasks, addedIds, archiveStatuses])

  const grouped = useMemo(() => {
    const pendingApproval: TodoTask[] = []
    const today: TodoTask[] = []
    const normal: TodoTask[] = []
    const archive: TodoTask[] = []

    for (const task of filtered) {
      if (archiveStatuses.has(task.status)) archive.push(task)
      else if (addedIds.has(task.id)) today.push(task)
      else if (task.status === 'pending_approval') pendingApproval.push(task)
      else normal.push(task)
    }

    if (viewMode === 'archive') {
      return [{ key: 'archive', title: `完了アーカイブ (${archive.length})`, tasks: archive }]
    }

    return [
      { key: 'pendingApproval', title: `着手判定 (${pendingApproval.length})`, tasks: pendingApproval },
      { key: 'today', title: `今日の作業 (${today.length})`, tasks: today },
      { key: 'normal', title: `通常ToDo (${normal.length})`, tasks: normal },
    ].filter((section) => section.tasks.length > 0)
  }, [filtered, archiveStatuses, addedIds, viewMode])

  return (
    <div className="space-y-4">

      {/* Action bar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href="#goal-todo-add"
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold transition-colors border bg-blue-600 border-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          <span className="text-base leading-none font-bold">+</span>
          <span>Goal配下にToDo追加</span>
          <span className="hidden sm:inline text-xs font-normal opacity-70">— Goal選択必須</span>
        </a>
        <Link
          href="/tasks/import"
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-semibold border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800"
        >
          <span className="text-base leading-none">↑</span>
          <span>JSON取り込み</span>
          <span className="hidden sm:inline text-xs font-normal opacity-60">— 複数件を一括登録</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-1.5 text-center">
        {[
          { label: '着手判定', value: counts.pendingApproval, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: '今日', value: counts.today, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: '通常', value: counts.normal, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800' },
          { label: 'ブロック', value: counts.blocked, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'アーカイブ', value: counts.archive, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-2`}>
            <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* View mode */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setViewMode('active')}
          className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
            viewMode === 'active'
              ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          作業中
        </button>
        <button
          onClick={() => setViewMode('archive')}
          className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
            viewMode === 'archive'
              ? 'bg-gray-900 dark:bg-gray-100 border-gray-900 dark:border-gray-100 text-white dark:text-gray-900'
              : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
          }`}
        >
          完了アーカイブ
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-3 space-y-3">
        {/* Filter header */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">絞り込み</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
          {statusFilter && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(statusFilter)}`}>
              {STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter)?.label}
            </span>
          )}
          {priorityFilter && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(priorityFilter)}`}>
              {PRIORITY_OPTIONS.find((o) => o.value === priorityFilter)?.label}
            </span>
          )}
          {assigneeFilter && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
              {ASSIGNEE_OPTIONS.find((o) => o.value === assigneeFilter)?.label}
            </span>
          )}
          {projectFilter && (
            <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
              {projects.find((p) => p.id === projectFilter)?.name ?? projectFilter}
            </span>
          )}
        </div>

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タスク名・案件名で検索..."
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />

        {/* Project select */}
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
        >
          <option value="">案件: すべて</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        {/* Status chips */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">ステータス</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTER_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setStatusFilter(o.value)}
                className={statusChipClass(o.value, statusFilter === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priority chips */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">優先度</p>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setPriorityFilter(o.value)}
                className={priorityChipClass(o.value, priorityFilter === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee chips */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5 font-medium">担当</p>
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNEE_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => setAssigneeFilter(o.value)}
                className={baseChipClass(assigneeFilter === o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary + reset */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-50 dark:border-gray-700">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {filtered.length} 件表示中
            {activeFilterCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium">
                {activeFilterCount}フィルター適用中
              </span>
            )}
          </span>
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              リセット
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-3xl mb-3 opacity-20 select-none">{activeFilterCount > 0 ? '🔍' : '📋'}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {activeFilterCount > 0 ? '条件に合うタスクはありません' : 'タスクがありません'}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {activeFilterCount > 0
                ? 'フィルターを変更するか、リセットしてください'
                : '案件にタスクを追加すると、ここに表示されます'}
            </p>
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="mt-3 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-colors underline"
              >
                フィルターをリセットして全件表示
              </button>
            )}
          </div>
        ) : (
          grouped.map((section) => (
            <section key={section.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {section.title}
                </h2>
                {section.key === 'today' && (
                  <Link href="/queue" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    今日の順番
                  </Link>
                )}
              </div>
              <div className="space-y-2">
              {section.tasks.map((task) => {
            const isQueued = addedIds.has(task.id)
            const isAdding = addingIds.has(task.id)
            const isBlocked = task.status === 'blocked'
            const isDone = archiveStatuses.has(task.status)
            const isInProgress = task.status === 'in_progress'
            const err = errors[task.id]
            const isEditing = editingId === task.id
            const editForm = editForms[task.id]
            const isSaving = savingIds.has(task.id)
            const saveResult = saveResults[task.id]

            const priorityBorderClass = !isBlocked && !isInProgress && !isDone
              ? task.priority === 'high'
                ? 'border-l-4 border-l-amber-400 dark:border-l-amber-500'
                : task.priority === 'medium'
                ? 'border-l-4 border-l-gray-300 dark:border-l-gray-500'
                : ''
              : ''

            return (
              <div
                key={task.id}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-3 border transition-opacity ${
                  isBlocked
                    ? 'border-red-200 dark:border-red-900/50 border-l-4 border-l-red-400 dark:border-l-red-500'
                    : isInProgress
                    ? 'border-blue-200 dark:border-blue-900/40 border-l-4 border-l-blue-400 dark:border-l-blue-500'
                    : isDone
                    ? 'border-gray-100 dark:border-gray-700 opacity-60'
                    : `border-gray-100 dark:border-gray-700 ${priorityBorderClass}`
                }`}
              >
                {isEditing && editForm ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">編集中: {task.projectName}</p>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], title: e.target.value } }))}
                      placeholder="タスク名 *"
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ステータス</label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], status: e.target.value as TaskStatus } }))}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">優先度</label>
                        <select
                          value={editForm.priority}
                          onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], priority: e.target.value as TaskPriority } }))}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {PRIORITY_OPTIONS_EDIT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">担当</label>
                        <select
                          value={editForm.assignee}
                          onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], assignee: e.target.value as TaskAssignee } }))}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {ASSIGNEE_OPTIONS_EDIT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <textarea
                      value={editForm.memo}
                      onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], memo: e.target.value } }))}
                      placeholder="メモ（任意）"
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                    />
                    {/* 詳細フィールド（折りたたみ） */}
                    <details className="group">
                      <summary className="text-xs text-blue-500 dark:text-blue-400 cursor-pointer select-none hover:text-blue-700 dark:hover:text-blue-300 py-1">
                        ▶ 詳細フィールド（完了条件・許可・禁止・リスク等）
                      </summary>
                      <div className="space-y-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">作業指示プロンプト <span className="text-violet-500">（Claude Codeへの専用指示）</span></label>
                          <textarea
                            value={editForm.taskPrompt}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], taskPrompt: e.target.value } }))}
                            placeholder="このToDoでClaude Codeに特に守ってほしいこと、作業手順、注意点を書く"
                            rows={4}
                            className="w-full rounded-lg border border-violet-200 dark:border-violet-700 px-3 py-2 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">対象アプリ</label>
                          <input
                            type="text"
                            value={editForm.targetApp}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], targetApp: e.target.value } }))}
                            placeholder="例: ny01/progress"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">変更対象パス</label>
                          <input
                            type="text"
                            value={editForm.targetPath}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], targetPath: e.target.value } }))}
                            placeholder="例: app/tasks/page.tsx"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">リスク</label>
                          <input
                            type="text"
                            value={editForm.risk}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], risk: e.target.value } }))}
                            placeholder="low / medium / high"
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">完了条件（1行1件）</label>
                          <textarea
                            value={editForm.doneCriteria}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], doneCriteria: e.target.value } }))}
                            placeholder="build成功&#10;TypeScriptエラーが0件"
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">許可事項（1行1件）</label>
                          <textarea
                            value={editForm.allowed}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], allowed: e.target.value } }))}
                            placeholder="UIコンポーネントの修正"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">禁止事項（1行1件）</label>
                          <textarea
                            value={editForm.forbidden}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], forbidden: e.target.value } }))}
                            placeholder="データ削除&#10;外部API追加"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">blocked理由</label>
                          <textarea
                            value={editForm.blockedReason}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], blockedReason: e.target.value } }))}
                            placeholder="環境変数が未設定のため"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">解除方法</label>
                          <textarea
                            value={editForm.unblockAction}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], unblockAction: e.target.value } }))}
                            placeholder=".env.localにSUPABASE_URLを設定する"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">次の質問</label>
                          <textarea
                            value={editForm.nextQuestion}
                            onChange={(e) => setEditForms((p) => ({ ...p, [task.id]: { ...p[task.id], nextQuestion: e.target.value } }))}
                            placeholder="デプロイ先のURLを確認してください"
                            rows={2}
                            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-1.5 text-xs bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                          />
                        </div>
                      </div>
                    </details>
                    {saveResult && saveResult !== 'ok' && <p className="text-xs text-red-500">{saveResult}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(task)}
                        disabled={isSaving || !editForm.title.trim()}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors"
                      >
                        {isSaving ? '保存中...' : '保存'}
                      </button>
                      <button
                        onClick={() => cancelEdit(task.id)}
                        className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className={`text-[15px] font-semibold leading-snug flex-1 min-w-0 ${
                        isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => startEdit(task)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => deleteTask(task)}
                          disabled={deletingIds.has(task.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-400 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40"
                          title="削除"
                        >
                          {deletingIds.has(task.id) ? '…' : '🗑'}
                        </button>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-1">
                      <PriorityBadge priority={task.priority} />
                      <StatusBadge status={task.status} />
                      {task.doneCriteria && task.doneCriteria.length > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                          完了条件 {task.doneCriteria.length}件
                        </span>
                      )}
                    </div>
                    {/* Meta row */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs text-blue-500 dark:text-blue-400 font-medium">{task.projectName}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${getAssigneeColor(task.assignee)}`}>
                        {getAssigneeLabel(task.assignee)}
                      </span>
                      {task.targetApp && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-mono">
                          {task.targetApp}
                        </span>
                      )}
                      {task.updatedAt && (
                        <span className="text-xs text-gray-300 dark:text-gray-600">{formatShortDate(task.updatedAt)}</span>
                      )}
                    </div>

                    {/* Blocked reason */}
                    {isBlocked && task.blockedReason && (
                      <div className="mb-2 px-2.5 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-600 dark:text-red-400 leading-snug">
                        <span className="font-semibold">ブロック理由: </span>{task.blockedReason}
                        {task.unblockAction && (
                          <p className="mt-1 text-red-500 dark:text-red-500">
                            <span className="font-semibold">解除: </span>{task.unblockAction}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Memo */}
                    {task.memo && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 leading-relaxed line-clamp-3">{task.memo}</p>
                    )}

                    {/* Next question */}
                    {task.nextQuestion && (
                      <div className="mb-2 px-2.5 py-2 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-xs text-teal-700 dark:text-teal-400 leading-snug">
                        <span className="font-semibold">次の質問: </span>{task.nextQuestion}
                      </div>
                    )}

                    <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/60 space-y-1.5">
                      {saveResult === 'ok' && (
                        <p className="text-xs text-green-600 dark:text-green-400">保存しました</p>
                      )}

                      {task.taskPrompt?.trim() && (
                        <button
                          onClick={() => copyPrompt(task.id, task.taskPrompt!)}
                          className="w-full py-1.5 rounded-xl text-xs font-medium border border-violet-200 dark:border-violet-700 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
                        >
                          {copiedPromptId === task.id ? '✓ コピーしました' : '📋 作業指示プロンプトをコピー'}
                        </button>
                      )}

                      <TaskPromptEditor
                        taskId={task.id}
                        projectId={task.projectId}
                        initialPrompt={task.taskPrompt}
                      />

                      {err && <p className="text-xs text-red-500">{err}</p>}

                      {!isDone && (
                        <button
                          onClick={() => addToQueue(task)}
                          disabled={isQueued || isAdding || isBlocked}
                          className={`w-full py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:cursor-not-allowed ${
                            isQueued
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                              : isBlocked
                              ? 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-300 dark:text-gray-600'
                              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700'
                          }`}
                        >
                          {isAdding
                            ? '追加中...'
                            : isQueued
                            ? '✓ 今日の作業に追加済み'
                            : isBlocked
                            ? 'ブロック中（追加不可）'
                            : task.status === 'pending_approval'
                            ? '承認して今日の作業に追加'
                            : '今日の作業に追加'}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
              })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
