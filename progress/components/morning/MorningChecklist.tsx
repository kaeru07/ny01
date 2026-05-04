'use client'

import { useState, useEffect } from 'react'

const ITEMS = [
  'VPSを起動した',
  'SSH接続できる',
  '/root/company を確認した',
  'progressアプリを起動した',
  '最新progressを読み込んだ',
  '着手判定待ちを確認した',
  '今日やるものをOKした',
  '今日の作業順番を生成した',
  'ユーザーが作業順番を確認・調整した',
  'Claude Codeへ作業開始指示を出す準備ができた',
]

function todayKey() {
  return `checklist-${new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}`
}

export default function MorningChecklist() {
  const [checked, setChecked] = useState<boolean[]>(new Array(ITEMS.length).fill(false))

  useEffect(() => {
    try {
      const saved = localStorage.getItem(todayKey())
      if (saved) setChecked(JSON.parse(saved))
    } catch {}
  }, [])

  function toggle(i: number) {
    setChecked((prev) => {
      const next = [...prev]
      next[i] = !next[i]
      try { localStorage.setItem(todayKey(), JSON.stringify(next)) } catch {}
      return next
    })
  }

  const doneCount = checked.filter(Boolean).length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">起動チェックリスト</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500">{doneCount}/{ITEMS.length}</span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((item, i) => (
          <li key={i}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => toggle(i)}
                className="mt-0.5 w-4 h-4 rounded accent-blue-500 flex-shrink-0 cursor-pointer"
              />
              <span className={`text-sm leading-snug transition-colors ${
                checked[i] ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400'
              }`}>
                {item}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {doneCount === ITEMS.length && (
        <p className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium text-center">
          ✓ 準備完了
        </p>
      )}
    </div>
  )
}
