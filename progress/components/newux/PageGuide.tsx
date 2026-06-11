// 各ページ上部の「このページでできること」ガイド。新UXの全ページに置く。
export default function PageGuide({ title, guide }: { title: string; guide: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
        {guide}
      </p>
    </header>
  )
}
