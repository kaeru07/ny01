'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function IdeaGenerator() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState('')

  async function generate() {
    setMessage('')
    const res = await fetch('/api/ideas', { method: 'POST' })
    if (!res.ok) {
      setMessage('生成に失敗しました')
      return
    }
    setMessage('投稿案を生成しました')
    startTransition(() => router.refresh())
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-blue-900">登録済みニュースから投稿案を生成</p>
          <p className="mt-1 text-sm text-blue-700">外部APIは使わず、ローカルのdata/news.jsonだけを参照します。</p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          生成する
        </button>
      </div>
      {message && <p className="mt-3 text-sm font-medium text-blue-800">{message}</p>}
    </div>
  )
}
