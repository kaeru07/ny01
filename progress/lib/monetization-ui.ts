import type { CandidateStatus, BlueOcean, Level } from '@/types/monetization'

// Monetization Hub の表示ヘルパー（色分け・バッジ）。純関数なので server/client 双方から使える。

export const STATUS_META: Record<CandidateStatus, { label: string; cls: string }> = {
  Draft: { label: 'Draft', cls: 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  Candidate: { label: 'Candidate', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  Review: { label: 'Review', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  Hold: { label: 'Hold', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  Approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  Rejected: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  EpicCreated: { label: 'EpicCreated', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  Building: { label: 'Building', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  Released: { label: 'Released', cls: 'bg-green-600 text-white dark:bg-green-600' },
}

export function statusMeta(status: CandidateStatus) {
  return STATUS_META[status] ?? STATUS_META.Draft
}

/** 総合スコアの色分け（高=緑 / 中=黄 / 低=赤）。 */
export function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500 text-white'
  if (score >= 65) return 'bg-lime-500 text-white'
  if (score >= 50) return 'bg-amber-500 text-white'
  return 'bg-rose-500 text-white'
}

export const BLUE_OCEAN_META: Record<BlueOcean, { emoji: string; label: string; cls: string }> = {
  green: { emoji: '🟢', label: 'ブルーオーシャン', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  yellow: { emoji: '🟡', label: '中間', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  red: { emoji: '🔴', label: 'レッドオーシャン', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
}

export function blueOceanMeta(bo?: BlueOcean) {
  if (!bo) return null
  return BLUE_OCEAN_META[bo] ?? null
}

/** 定性レベルの日本語 + 色。reverse=true なら high を悪い色にする（競合強度・SEO難易度向け）。 */
export function levelMeta(level?: Level, reverse = false): { label: string; cls: string } | null {
  if (!level) return null
  const good = 'text-emerald-600 dark:text-emerald-400'
  const mid = 'text-amber-600 dark:text-amber-400'
  const bad = 'text-rose-600 dark:text-rose-400'
  const labels: Record<Level, string> = { high: '高', medium: '中', low: '低' }
  let cls: string
  if (level === 'medium') cls = mid
  else if (level === 'high') cls = reverse ? bad : good
  else cls = reverse ? good : bad
  return { label: labels[level], cls }
}
