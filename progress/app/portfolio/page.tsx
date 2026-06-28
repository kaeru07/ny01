export const dynamic = 'force-dynamic'

import Link from 'next/link'
import PageGuide from '@/components/newux/PageGuide'
import FilterBar from '@/components/newux/FilterBar'
import FilterChips from '@/components/newux/FilterChips'
import ProjectGoalsView from '@/components/projects/ProjectGoalsView'
import { buildProjectPortfolio } from '@/lib/command-center'
import { buildProgressFilterUrl, parseProgressFilters, updateFilterParam } from '@/lib/progress-filters'

// Projects = いま動いているプロジェクトの一覧。状態 / 次の作業 / 最終更新 / 収益化状況。

const toneClass: Record<string, string> = {
  ok: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  wait: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  done: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

function fmt(dt?: string): string {
  if (!dt) return '不明'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function matchesProject(project: Awaited<ReturnType<typeof buildProjectPortfolio>>[number], q?: string): boolean {
  if (!q) return true
  const haystack = [project.name, project.statusLabel, project.nextWork, project.monetizationLabel].filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(q.toLowerCase())
}

function ProjectTabBar({ active }: { active: 'projects' | 'goals' }) {
  const base = 'flex-1 text-center rounded-lg px-3 py-2 text-xs font-bold transition-colors'
  const on = 'bg-blue-600 text-white'
  const off = 'border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
  return (
    <div className="flex gap-2">
      <Link href="/portfolio" className={`${base} ${active === 'projects' ? on : off}`}>案件一覧</Link>
      <Link href="/portfolio?tab=goals" className={`${base} ${active === 'goals' ? on : off}`}>ゴール進捗</Link>
    </div>
  )
}

export default async function PortfolioPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const tab = searchParams?.tab === 'goals' ? 'goals' : 'projects'
  if (tab === 'goals') {
    return (
      <div className="space-y-5 px-4 pb-6 pt-6">
        <PageGuide title="Projects" guide="進行中プロジェクトの状況を確認します。「あなたの作業待ち」のものから手を付けるのがおすすめです。" />
        <ProjectTabBar active="goals" />
        <ProjectGoalsView />
      </div>
    )
  }

  const allProjects = await buildProjectPortfolio()
  const filters = parseProgressFilters(searchParams)
  const projects = allProjects.filter((project) => {
    if (filters.status && project.statusTone !== filters.status && project.statusLabel !== filters.status) return false
    if (!matchesProject(project, filters.q)) return false
    return true
  })
  const statusOptions = Array.from(new Map(allProjects.map((project) => [project.statusTone, project.statusLabel])).entries())
    .map(([value, label]) => ({ value, label }))

  return (
    <div className="space-y-5 px-4 pb-6 pt-6">
      <PageGuide title="Projects" guide="進行中プロジェクトの状況を確認します。「あなたの作業待ち」のものから手を付けるのがおすすめです。" />
      <ProjectTabBar active="projects" />

      <section className="space-y-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">全{allProjects.length}件中 {projects.length}件表示</p>
        <FilterBar
          basePath="/portfolio"
          filters={filters}
          quickFilters={[
            { key: 'all', label: 'すべて', patch: { status: undefined, q: undefined }, active: !filters.status && !filters.q },
            ...statusOptions.map((option) => ({ key: option.value, label: option.label, patch: { status: option.value }, active: filters.status === option.value })),
          ]}
          selectFilters={[
            { key: 'status', label: 'status', placeholder: 'すべての状態', options: statusOptions },
          ]}
          showSearch
        />
        <FilterChips
          clearHref="/portfolio"
          chips={[
            { key: 'status', label: `状態: ${statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status}`, active: Boolean(filters.status), href: buildProgressFilterUrl('/portfolio', updateFilterParam(filters, { status: undefined })) },
            { key: 'q', label: `検索: ${filters.q}`, active: Boolean(filters.q), href: buildProgressFilterUrl('/portfolio', updateFilterParam(filters, { q: undefined })) },
          ]}
        />
      </section>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {projects.map((p) => (
          <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-1.5">
              <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">{p.name}</p>
              <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${toneClass[p.statusTone]}`}>{p.statusLabel}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${p.progressPct}%` }} />
              </div>
              <span className="w-9 text-right text-xs font-bold text-gray-900 dark:text-gray-100">{p.progressPct}%</span>
            </div>
            <dl className="mt-2 space-y-1 text-[11px]">
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-gray-400">残作業</dt>
                <dd className="text-gray-700 dark:text-gray-200">{p.remainingWorkCount}作業</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-gray-400">次</dt>
                <dd className="line-clamp-2 text-gray-700 dark:text-gray-200">{p.nextWork}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-gray-400">更新</dt>
                <dd className="text-gray-700 dark:text-gray-200">{fmt(p.updatedAt)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-gray-400">収益化</dt>
                <dd className="line-clamp-1 text-gray-700 dark:text-gray-200">{p.monetizationLabel}</dd>
              </div>
            </dl>
          </li>
        ))}
        {projects.length === 0 && (
          <li className="col-span-2 rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 md:col-span-3">
            動いているプロジェクトはありません。
          </li>
        )}
      </ul>

      <p className="text-center text-[11px] text-gray-400">
        旧「案件」一覧（全{'15'}件・休止中含む）は Legacy → 案件 にあります
      </p>
    </div>
  )
}
