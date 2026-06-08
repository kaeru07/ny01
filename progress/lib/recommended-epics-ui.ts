import type { RecommendationStatus, MonetizationImpact } from '@/types/recommended-epic'

// おすすめ追加Epic の表示ヘルパー（純関数・server/client 両用）。

export const REC_STATUS_META: Record<RecommendationStatus, { label: string; cls: string }> = {
  suggested: { label: 'suggested', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  approved: { label: 'approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'rejected', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  hold: { label: 'hold', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  epic_created: { label: 'epic_created', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
}

export function recStatusMeta(s: RecommendationStatus) {
  return REC_STATUS_META[s] ?? REC_STATUS_META.suggested
}

export const IMPACT_META: Record<MonetizationImpact, { label: string; cls: string }> = {
  high: { label: '収益 高', cls: 'bg-emerald-500 text-white' },
  medium: { label: '収益 中', cls: 'bg-amber-500 text-white' },
  low: { label: '収益 低', cls: 'bg-gray-400 text-white' },
  none: { label: '収益 -', cls: 'bg-gray-300 text-gray-700' },
}

export function impactMeta(i: MonetizationImpact) {
  return IMPACT_META[i] ?? IMPACT_META.none
}
