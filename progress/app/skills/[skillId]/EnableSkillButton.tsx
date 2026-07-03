'use client'

import { useState } from 'react'

interface Props {
  skillId: string
  enabled: boolean
}

export default function EnableSkillButton({ skillId, enabled }: Props) {
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function submit() {
    if (enabled && !confirming) {
      setConfirming(true)
      return
    }
    setPending(true)
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: enabled ? 'disable' : 'enable' }),
      })
      if (!res.ok) throw new Error(await res.text())
      window.location.reload()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={submit}
      disabled={pending}
      className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      {pending ? '処理中' : enabled ? (confirming ? '本当に無効にする' : '無効にする') : '有効にする'}
    </button>
  )
}
