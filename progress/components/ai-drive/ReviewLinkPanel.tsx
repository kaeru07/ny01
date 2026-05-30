import Link from 'next/link'
import type { ReviewLink } from '@/types/ai-drive'

interface Props {
  links: ReviewLink[]
}

export default function ReviewLinkPanel({ links }: Props) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300">レビュー / ExecutionRun 連携</h2>
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 space-y-3">
        <ol className="space-y-1.5 text-[12px] text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span className="text-gray-400 flex-shrink-0">1.</span>
            <span>実行後は <code className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">ExecutionRun</code> に保存</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 flex-shrink-0">2.</span>
            <span><code className="text-blue-600 dark:text-blue-400 font-mono text-[11px]">/logs?mode=review</code> で ChatGPT レビューへ</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 flex-shrink-0">3.</span>
            <span>レビュー結果から次 ToDo 候補を生成</span>
          </li>
          <li className="flex gap-2">
            <span className="text-gray-400 flex-shrink-0">4.</span>
            <span>Vault 保存用 Markdown で長期記憶へ戻す</span>
          </li>
        </ol>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-2.5 transition-colors"
            >
              <div className="text-[12px] font-semibold text-blue-700 dark:text-blue-300 leading-tight">
                {l.label} →
              </div>
              <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 leading-tight">
                {l.description}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
