'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { buildProgressFilterUrl, clearFilters, parseProgressFilters, updateFilterParam, type ProgressFilterState } from '@/lib/progress-filters'

export interface FilterOption {
  key: string
  label: string
  patch: Partial<ProgressFilterState>
  active?: boolean
}

export interface SelectFilter {
  key: keyof ProgressFilterState
  label: string
  placeholder: string
  options: Array<{ value: string; label: string }>
}

export default function FilterBar({
  basePath,
  filters: filtersProp,
  quickFilters,
  selectFilters = [],
  showSearch = false,
  clearKeepKeys = [],
}: {
  basePath?: string
  filters?: ProgressFilterState
  quickFilters: FilterOption[]
  selectFilters?: SelectFilter[]
  showSearch?: boolean
  clearKeepKeys?: Array<keyof ProgressFilterState>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const filters = filtersProp ?? parseProgressFilters(searchParams)
  const path = basePath ?? pathname

  const [draftQ, setDraftQ] = useState(filters.q ?? '')

  const clearUrl = useMemo(() => buildProgressFilterUrl(path, clearFilters(filters, clearKeepKeys)), [clearKeepKeys, filters, path])

  function apply(patch: Partial<ProgressFilterState>) {
    router.replace(buildProgressFilterUrl(path, updateFilterParam(filters, patch)), { scroll: false })
  }

  function clear() {
    router.replace(clearUrl, { scroll: false })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickFilters.map((option) => {
          const active = option.active ?? Object.entries(option.patch).every(([key, value]) => filters[key as keyof ProgressFilterState] === value)
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => apply(active ? {} : option.patch)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${
                active
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {option.label}
            </button>
          )
        })}
        {(selectFilters.length > 0 || showSearch) && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
          >
            絞り込み
          </button>
        )}
        <button
          type="button"
          onClick={clear}
          className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-500 dark:border-gray-700 dark:text-gray-400"
        >
          クリア
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {selectFilters.map((filter) => (
              <label key={String(filter.key)} className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <span>{filter.label}</span>
                <select
                  value={(filters[filter.key] as string | undefined) ?? ''}
                  onChange={(event) => apply({ [filter.key]: event.target.value || undefined })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                >
                  <option value="">{filter.placeholder}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            ))}
            {showSearch && (
              <label className="space-y-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <span>検索</span>
                <div className="flex gap-2">
                  <input
                    value={draftQ}
                    onChange={(event) => setDraftQ(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') apply({ q: draftQ.trim() || undefined })
                    }}
                    placeholder="タイトル・理由・本文で検索"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => apply({ q: draftQ.trim() || undefined })}
                    className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-bold text-white dark:bg-gray-100 dark:text-gray-900"
                  >
                    適用
                  </button>
                </div>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
