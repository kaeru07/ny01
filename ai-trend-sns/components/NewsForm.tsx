'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { NewsCategory } from '@/types/sns'

const categories: NewsCategory[] = ['model', 'coding', 'product', 'research', 'business', 'security', 'other']

export default function NewsForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    const res = await fetch('/api/news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? '保存に失敗しました')
      return
    }
    event.currentTarget.reset()
    startTransition(() => router.refresh())
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          title
          <input name="title" required className="rounded-lg border border-line px-3 py-2" placeholder="例: 新モデル発表" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          sourceName
          <input name="sourceName" required className="rounded-lg border border-line px-3 py-2" placeholder="例: OpenAI" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        sourceUrl
        <input name="sourceUrl" required type="url" className="rounded-lg border border-line px-3 py-2" placeholder="https://..." />
      </label>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        summary
        <textarea name="summary" required rows={3} className="rounded-lg border border-line px-3 py-2" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          category
          <select name="category" defaultValue="coding" className="rounded-lg border border-line px-3 py-2">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          importance
          <input name="importance" type="number" min="1" max="5" defaultValue="3" className="rounded-lg border border-line px-3 py-2" />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        memo
        <textarea name="memo" rows={3} className="rounded-lg border border-line px-3 py-2" placeholder="個人開発者にどう関係するか" />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
        ニュースを保存
      </button>
    </form>
  )
}
