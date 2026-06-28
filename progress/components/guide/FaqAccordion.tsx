'use client'

export default function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">タップで開きます</p>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <details
            key={item.q}
            className="group rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
          >
            <summary className="min-h-12 cursor-pointer list-none px-4 py-3 text-sm font-black leading-relaxed text-gray-900 marker:hidden dark:text-gray-100">
              <span className="flex items-start justify-between gap-3">
                <span>Q. {item.q}</span>
                <span className="shrink-0 text-base text-blue-600 group-open:rotate-45 dark:text-blue-300">＋</span>
              </span>
            </summary>
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 text-xs font-medium leading-relaxed text-gray-600 dark:border-gray-800 dark:text-gray-300">
              A. {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
