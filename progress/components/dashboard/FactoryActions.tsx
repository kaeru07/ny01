'use client'

import { useState } from 'react'
import type { Goal, GoalStatus } from '@/types/goal'
import type { EpicPriority } from '@/lib/types/operations'

const inputCls = 'w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100'

async function patchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? '保存に失敗しました')
  return data
}

export function GoalQuickForm({ goals }: { goals: Goal[] }) {
  const [editingId, setEditingId] = useState(goals[0]?.id ?? '')
  const editing = goals.find((g) => g.id === editingId)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? editing?.summary ?? '')
  const [metric, setMetric] = useState(editing?.metric ?? 'progress')
  const [target, setTarget] = useState(String(editing?.target ?? 100))
  const [current, setCurrent] = useState(String(editing?.current ?? 0))
  const [priority, setPriority] = useState(editing?.priority ?? 'medium')
  const [status, setStatus] = useState<GoalStatus>(editing?.status ?? 'active')
  const [isNorthStar, setIsNorthStar] = useState(editing?.isNorthStar ?? goals.length === 0)
  const [setAsMain, setSetAsMain] = useState(goals.length === 0)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  function load(id: string) {
    setEditingId(id)
    const g = goals.find((goal) => goal.id === id)
    setTitle(g?.title ?? '')
    setDescription(g?.description ?? g?.summary ?? '')
    setMetric(g?.metric ?? 'progress')
    setTarget(String(g?.target ?? 100))
    setCurrent(String(g?.current ?? 0))
    setPriority(g?.priority ?? 'medium')
    setStatus(g?.status ?? 'active')
    setIsNorthStar(g?.isNorthStar ?? false)
    setSetAsMain(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      await patchJson('/api/goals', {
        id: editingId || undefined,
        title,
        description,
        metric,
        target: Number(target),
        current: Number(current),
        priority,
        status,
        isNorthStar,
        setAsMain,
      })
      setMessage('保存しました')
      window.location.reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex gap-2">
        <select value={editingId} onChange={(e) => load(e.target.value)} className={inputCls}>
          <option value="">新規Goal</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" className={inputCls} required />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="description" rows={2} className={inputCls} />
      <div className="grid grid-cols-3 gap-2">
        <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="metric" className={inputCls} />
        <input value={current} onChange={(e) => setCurrent(e.target.value)} type="number" className={inputCls} />
        <input value={target} onChange={(e) => setTarget(e.target.value)} type="number" className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={priority} onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')} className={inputCls}>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)} className={inputCls}>
          <option value="active">active</option>
          <option value="paused">paused</option>
          <option value="done">done</option>
          <option value="dropped">dropped</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={isNorthStar} onChange={(e) => setIsNorthStar(e.target.checked)} /> North Star</label>
        <label className="inline-flex items-center gap-1"><input type="checkbox" checked={setAsMain} onChange={(e) => setSetAsMain(e.target.checked)} /> mainGoal</label>
      </div>
      <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? '保存中' : 'Goalを保存'}</button>
      {message && <p className="text-xs text-gray-500">{message}</p>}
    </form>
  )
}

export function EpicDecisionControls({ epicId, goals, currentGoalId, currentPriority }: { epicId: string; goals: Goal[]; currentGoalId?: string; currentPriority?: string }) {
  const [goalId, setGoalId] = useState(currentGoalId ?? goals[0]?.id ?? '')
  const [priority, setPriority] = useState<EpicPriority>((currentPriority as EpicPriority) ?? 'P1')
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')

  async function act(action: 'approve' | 'reject' | 'assignGoal' | 'changePriority') {
    setBusy(action)
    setMessage('')
    try {
      await patchJson('/api/operations/epics', { epicId, action, goalId, priority })
      window.location.reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={inputCls}>
          <option value="">Goalを選択</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <button onClick={() => act('assignGoal')} disabled={!goalId || busy === 'assignGoal'} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-40 dark:border-blue-800 dark:text-blue-300">紐付け</button>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <select value={priority} onChange={(e) => setPriority(e.target.value as EpicPriority)} className={inputCls}>
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
        </select>
        <button onClick={() => act('changePriority')} disabled={busy === 'changePriority'} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200">優先度</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => act('approve')} disabled={busy === 'approve'} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">approve</button>
        <button onClick={() => act('reject')} disabled={busy === 'reject'} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">reject</button>
      </div>
      {message && <p className="text-xs text-rose-500">{message}</p>}
    </div>
  )
}

export function ReviewControls({ runId }: { runId: string }) {
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)

  async function markReviewed() {
    setBusy(true)
    try {
      await patchJson(`/api/execution-runs/${runId}`, { reviewStatus: 'reviewed', reviewMemo: memo })
      window.location.reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="reviewメモ" className={inputCls} />
      <button onClick={markReviewed} disabled={busy} className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900">markReviewed</button>
    </div>
  )
}

export function CopyPacketButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }
  return (
    <button onClick={copy} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
      {copied ? 'copied' : 'copy'}
    </button>
  )
}
