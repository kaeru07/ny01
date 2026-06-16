'use client'

import Link from 'next/link'

export interface FilterChip {
  key: string
  label: string
  href?: string
  active?: boolean
}

export default function FilterChips({ chips, clearHref }: { chips: FilterChip[]; clearHref?: string }) {
  const active = chips.filter((chip) => chip.active)
  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[11px] font-semibold text-gray-400">選択中</span>
      {active.map((chip) => (
        <Link
          key={chip.key}
          href={chip.href ?? '#'}
          className="shrink-0 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white dark:bg-gray-100 dark:text-gray-900"
        >
          {chip.label} ×
        </Link>
      ))}
      {clearHref && (
        <Link href={clearHref} className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-600 dark:border-gray-700 dark:text-gray-300">
          クリア
        </Link>
      )}
    </div>
  )
}
