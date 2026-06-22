'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { GoalTodoStatus } from '@/types/goal'

interface GoalOption {
  id: string
  title: string
  phases: { id: string; title: string }[]
}

interface Props {
  goals: GoalOption[]
  defaultGoalId?: string
  compact?: boolean
}

const STATUS_OPTIONS: GoalTodoStatus[] = ['pending', 'active', 'done', 'skipped']

export default function GoalTodoAddForm({ goals, defaultGoalId = '', compact = false }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [goalId, setGoalId] = useState(defaultGoalId)
  const [title, setTitle] = useState('')
  const [taskPrompt, setTaskPrompt] = useState('')
  const [status, setStatus] = useState<GoalTodoStatus>('pending')
  const [nextAction, setNextAction] = useState('')
  const [doneCriteria, setDoneCriteria] = useState('')
  const [dueHint, setDueHint] = useState('')
  const [phaseId, setPhaseId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const selectedGoal = useMemo(() => goals.find((goal) => goal.id === goalId), [goals, goalId])

  async function save() {
    setMessage('')
    if (!goalId) {
      setMessage('Goalを選択してください')
      return
    }
    if (!title.trim()) {
      setMessage('title を入力してください')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'appendTodos',
          goalId,
          todos: [{
            title,
            taskPrompt,
            status,
            nextAction,
            doneCriteria: doneCriteria.split('\n').map((v) => v.trim()).filter(Boolean),
            dueHint,
            phaseId,
            source: 'manual_todo',
          }],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        setMessage(data.error ?? '保存に失敗しました')
        return
      }
      setMessage('GoalにToDoを追加しました')
      setTitle('')
      setTaskPrompt('')
      setNextAction('')
      setDoneCriteria('')
      setDueHint('')
      startTransition(() => router.refresh())
    } catch {
      setMessage('通信エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="goal-todo-add" className={`rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">ToDoをGoalに紐づけて追加</h2>
        <span className="text-[11px] font-medium text-gray-400">Goal必須</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">対象Goal *</label>
          <select value={goalId} onChange={(e) => { setGoalId(e.target.value); setPhaseId(''); setMessage('') }} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <option value="">Goalを選択してください</option>
            {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">title *</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as GoalTodoStatus)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">phaseId</label>
          <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} disabled={!selectedGoal} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200">
            <option value="">先頭フェーズへ</option>
            {selectedGoal?.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.title}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">nextAction</label>
          <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">dueHint</label>
          <input value={dueHint} onChange={(e) => setDueHint(e.target.value)} placeholder="任意" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">prompt(taskPrompt)</label>
          <textarea value={taskPrompt} onChange={(e) => setTaskPrompt(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">doneCriteria (1行1件)</label>
          <textarea value={doneCriteria} onChange={(e) => setDoneCriteria(e.target.value)} rows={2} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" />
        </div>
      </div>
      {message && <p className={`text-xs ${message.includes('追加しました') ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{message}</p>}
      <button type="button" onClick={save} disabled={saving || !title.trim()} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40">
        {saving ? '保存中...' : 'Goal配下にToDoを追加'}
      </button>
    </section>
  )
}
