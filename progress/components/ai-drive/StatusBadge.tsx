import type { AIDriveStatus, MonetizationImpact } from '@/types/ai-drive'

const statusStyles: Record<AIDriveStatus, { label: string; bg: string; text: string }> = {
  draft: { label: '下書き', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300' },
  planning: { label: '計画中', bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300' },
  needs_human_decision: {
    label: '人間判断待ち',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    text: 'text-amber-700 dark:text-amber-300',
  },
  approved: { label: '承認済み', bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300' },
  running: { label: '実行中', bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300' },
  review_waiting: {
    label: 'レビュー待ち',
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    text: 'text-purple-700 dark:text-purple-300',
  },
  reviewed: { label: 'レビュー済み', bg: 'bg-teal-100 dark:bg-teal-900/40', text: 'text-teal-700 dark:text-teal-300' },
  next_loop: {
    label: '次ループへ',
    bg: 'bg-indigo-100 dark:bg-indigo-900/40',
    text: 'text-indigo-700 dark:text-indigo-300',
  },
  blocked: { label: '停止中', bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300' },
}

export function StatusBadge({ status }: { status: AIDriveStatus }) {
  const style = statusStyles[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}

const impactStyles: Record<MonetizationImpact, { label: string; bg: string; text: string }> = {
  high: { label: '収益化High', bg: 'bg-rose-500', text: 'text-white' },
  medium: { label: '収益化Med', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300' },
  low: { label: '収益化Low', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400' },
  none: { label: '収益化なし', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500' },
}

export function ImpactBadge({ impact }: { impact: MonetizationImpact }) {
  const style = impactStyles[impact]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
