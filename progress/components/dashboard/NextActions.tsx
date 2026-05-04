import Link from 'next/link'
import type { Project } from '@/types/progress'

interface NextActionsProps {
  projects: Project[]
}

function statusBadgeClass(status: string): string {
  if (status === 'blocked') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
}

function statusLabel(status: string): string {
  if (status === 'blocked') return 'ブロック'
  return '進行中'
}

export default function NextActions({ projects }: NextActionsProps) {
  const active = projects.filter((p) => p.status === 'in_progress' || p.status === 'active' || p.status === 'blocked')

  if (active.length === 0) return null

  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 px-0.5">
        次の一手
      </h2>
      <div className="space-y-2">
        {active.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <div className={`bg-white dark:bg-gray-800 rounded-xl border px-4 py-3 flex items-center gap-3 hover:shadow-sm transition-all active:scale-[0.99] ${
              p.status === 'blocked'
                ? 'border-red-200 dark:border-red-900/50'
                : 'border-gray-100 dark:border-gray-700 hover:border-blue-100 dark:hover:border-blue-800'
            }`}>
              <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold ${statusBadgeClass(p.status)}`}>
                {statusLabel(p.status)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{p.name}</p>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate mt-0.5">{p.nextAction}</p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
