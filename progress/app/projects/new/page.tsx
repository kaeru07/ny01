import Link from 'next/link'
import ProjectCreateForm from '@/components/projects/ProjectCreateForm'

export default function NewProjectPage() {
  return (
    <div className="px-4 pt-6 pb-4">
      <Link href="/projects" className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 mb-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        案件一覧
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">案件を追加</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">app-progress.json に追記されます</p>
      </header>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4">
        <ProjectCreateForm />
      </div>
    </div>
  )
}
