import type { DashboardStats } from '@/types/progress'

const stats = (s: DashboardStats) => [
  { label: '進行中', value: s.inProgress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { label: '完了', value: s.done, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  { label: 'ブロック', value: s.blocked, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
  { label: '合計', value: s.total, color: 'text-gray-600 dark:text-gray-300', bg: 'bg-gray-50 dark:bg-gray-800' },
]

export default function StatsBar({ data }: { data: DashboardStats }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {stats(data).map((item) => (
        <div key={item.label} className={`${item.bg} rounded-2xl p-3 text-center border border-transparent`}>
          <p className={`text-3xl font-bold leading-none ${item.color}`}>{item.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
