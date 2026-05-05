'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { NewsCategory, Platform } from '@/types/sns'

const platforms: Platform[] = ['x', 'youtube', 'note', 'blog', 'other']
const categories: NewsCategory[] = ['model', 'coding', 'product', 'research', 'business', 'security', 'other']

export default function PostLogForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    const res = await fetch('/api/posts', {
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
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          postedAt
          <input name="postedAt" type="datetime-local" required className="rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          platform
          <select name="platform" defaultValue="x" className="rounded-lg border border-line px-3 py-2">
            {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          category
          <select name="category" defaultValue="coding" className="rounded-lg border border-line px-3 py-2">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        content
        <textarea name="content" required rows={5} className="rounded-lg border border-line px-3 py-2" />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {['impressions', 'likes', 'bookmarks', 'replies', 'follows'].map((name) => (
          <label key={name} className="grid gap-1 text-sm font-medium text-slate-700">
            {name}
            <input name={name} type="number" min="0" defaultValue="0" className="rounded-lg border border-line px-3 py-2" />
          </label>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={pending} className="rounded-lg bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50">
        投稿ログを保存
      </button>
    </form>
  )
}
