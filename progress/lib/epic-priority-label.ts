import type { EpicPriority } from '@/lib/types/operations'

// 内部の優先度コード(P0/P1/P2)はユーザーに見せない。画面表示は人間語(高/中/低)に変換する。
// 値(value)は P0/P1/P2 のまま使い、ラベルだけ差し替える。
export const EPIC_PRIORITY_LABEL: Record<EpicPriority, string> = { P0: '高', P1: '中', P2: '低' }

export function epicPriorityLabel(p?: string | null): string {
  if (p && p in EPIC_PRIORITY_LABEL) return EPIC_PRIORITY_LABEL[p as EpicPriority]
  return p ?? '中'
}
