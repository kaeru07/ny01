'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DecisionPolicy, EpicPriority, EpicRiskFlag } from '@/lib/types/operations'
import type { Goal } from '@/types/goal'
import { DECISION_POLICIES, EPIC_PRIORITIES, RISK_FLAGS, APPROVAL_RISK_FLAGS, CAUTION_RISK_FLAGS, decisionPolicyLabel } from '@/lib/epic-contract'

const RISK_LABEL: Record<EpicRiskFlag, string> = {
  billing: '課金 billing',
  production_db: '本番DB',
  auth_secret: '認証/秘密',
  deploy: 'デプロイ',
  migration: 'migration',
  destructive: '破壊的',
  external_publish: '外部公開',
}

const inputCls =
  'w-full rounded-xl border border-gray-200 dark:border-gray-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white dark:bg-gray-700 dark:text-gray-100'

export default function EpicCreateForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  const [goalId, setGoalId] = useState('')
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [doneCriteria, setDoneCriteria] = useState<string[]>([''])
  const [decisionPolicy, setDecisionPolicy] = useState<DecisionPolicy>('autonomous')
  const [priority, setPriority] = useState<EpicPriority>('P1')
  const [riskFlags, setRiskFlags] = useState<EpicRiskFlag[]>([])
  const [notes, setNotes] = useState('')
  const [targetApp, setTargetApp] = useState('')

  useEffect(() => {
    fetch('/api/goals')
      .then((res) => res.json())
      .then((data) => {
        const loaded = Array.isArray(data.goals) ? data.goals : []
        setGoals(loaded)
        setGoalId((current) => current || data.mainGoalId || loaded[0]?.id || '')
      })
      .catch(() => setGoals([]))
  }, [])

  function setCriterion(i: number, v: string) {
    setDoneCriteria((arr) => arr.map((c, idx) => (idx === i ? v : c)))
  }
  function addCriterion() {
    setDoneCriteria((arr) => [...arr, ''])
  }
  function removeCriterion(i: number) {
    setDoneCriteria((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)))
  }
  function toggleFlag(f: EpicRiskFlag) {
    setRiskFlags((arr) => (arr.includes(f) ? arr.filter((x) => x !== f) : [...arr, f]))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrors([])
    try {
      const res = await fetch('/api/operations/epics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          goalId,
          goal,
          doneCriteria: doneCriteria.map((c) => c.trim()).filter(Boolean),
          decisionPolicy,
          priority,
          riskFlags,
          notes: notes.trim() || undefined,
          targetApp: targetApp.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setErrors(data.errors ?? ['作成に失敗しました'])
        return
      }
      router.push(`/epic/${data.epic.epicId}`)
      router.refresh()
    } catch {
      setErrors(['作成に失敗しました。再試行してください。'])
    } finally {
      setLoading(false)
    }
  }

  const approvalFlags = riskFlags.filter((f) => APPROVAL_RISK_FLAGS.includes(f))
  const cautionOnly = riskFlags.filter((f) => CAUTION_RISK_FLAGS.includes(f))
  const hasApprovalRisk = approvalFlags.length > 0
  const hasCautionOnly = cautionOnly.length > 0 && !hasApprovalRisk
  const isManual = decisionPolicy === 'manual'

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">goalId <span className="text-red-400">*</span></label>
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)} className={inputCls} required>
          <option value="">Goalを選択</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        {goals.length === 0 && <p className="mt-1 text-[11px] text-amber-600">先にホームでGoalを作成してください。</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">title <span className="text-red-400">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Epic のタイトル" className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">goal（目標）<span className="text-red-400">*</span></label>
        <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="この Epic で達成したいこと" className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">doneCriteria（完了条件）<span className="text-red-400">*</span></label>
        <div className="space-y-2">
          {doneCriteria.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={c} onChange={(e) => setCriterion(i, e.target.value)} placeholder={`完了条件 ${i + 1}`} className={inputCls} />
              <button type="button" onClick={() => removeCriterion(i)} disabled={doneCriteria.length <= 1} className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-2 text-sm text-gray-500 disabled:opacity-30 dark:border-gray-600">−</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addCriterion} className="mt-2 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 dark:border-blue-700 dark:text-blue-300">＋ 完了条件を追加</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">decisionPolicy <span className="text-red-400">*</span></label>
          <select value={decisionPolicy} onChange={(e) => setDecisionPolicy(e.target.value as DecisionPolicy)} className={inputCls}>
            {DECISION_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">priority <span className="text-red-400">*</span></label>
          <select value={priority} onChange={(e) => setPriority(e.target.value as EpicPriority)} className={inputCls}>
            {EPIC_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <p className="-mt-2 text-[11px] text-gray-400">{decisionPolicyLabel(decisionPolicy)}</p>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">riskFlags（該当するものをチェック）</label>
        <div className="grid grid-cols-2 gap-2">
          {RISK_FLAGS.map((f) => (
            <label key={f} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${riskFlags.includes(f) ? 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20' : 'border-gray-200 dark:border-gray-700'}`}>
              <input type="checkbox" checked={riskFlags.includes(f)} onChange={() => toggleFlag(f)} className="accent-rose-500" />
              <span className="text-gray-700 dark:text-gray-200">{RISK_LABEL[f]}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">targetApp（任意）</label>
        <input value={targetApp} onChange={(e) => setTargetApp(e.target.value)} placeholder="progress" className={inputCls} />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">notes（任意）</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="補足" className={inputCls} />
      </div>

      {isManual && (
        <p className="rounded-lg bg-gray-100 px-3 py-2 text-[11px] text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
          decisionPolicy=manual のため Factory対象外（手動対応）になります。
        </p>
      )}
      {hasApprovalRisk && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          riskFlags（{approvalFlags.join(', ')}）があるため、自動実行はされず「要承認」になります。
        </p>
      )}
      {hasCautionOnly && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-[11px] text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
          deploy は承認不要・自動実行対象のままです（「⚠ デプロイ注意」表示になります）。
        </p>
      )}

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 dark:border-red-900/40 dark:bg-red-900/20">
          {errors.map((er, i) => <li key={i} className="text-sm text-red-700 dark:text-red-300">・{er}</li>)}
        </ul>
      )}

      <button type="submit" disabled={loading} className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-40">
        {loading ? '作成中…' : 'Epic を作成'}
      </button>
    </form>
  )
}
