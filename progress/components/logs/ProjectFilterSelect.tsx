'use client'

import { useRouter } from 'next/navigation'

interface Props {
  projects: { id: string; name: string }[]
  currentProject?: string
  currentMode?: string
  currentType?: string
}

export default function ProjectFilterSelect({ projects, currentProject, currentMode, currentType }: Props) {
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params: Record<string, string> = {}
    if (currentMode && currentMode !== 'event') params['mode'] = currentMode
    if (e.target.value) params['project'] = e.target.value
    if (currentType) params['type'] = currentType
    const qs = new URLSearchParams(params).toString()
    router.push('/logs' + (qs ? '?' + qs : ''))
  }

  return (
    <div className="relative">
      <select
        value={currentProject ?? ''}
        onChange={handleChange}
        className="w-full appearance-none rounded-xl border border-gray-200 dark:border-gray-600 pl-3 pr-8 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
      >
        <option value="">全案件</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  )
}
