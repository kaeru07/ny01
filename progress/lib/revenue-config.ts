import { readJson } from '@/lib/store'

export type RevenueMilestoneKind = 'mvp' | 'publish' | 'monetization_setup' | 'static'
export type RevenueMilestoneState = 'done' | 'current' | 'todo'

export interface RevenueConfigMilestone {
  id: string
  kind: RevenueMilestoneKind
  label: string
  state?: RevenueMilestoneState
  note?: string
}

export interface RevenueConfig {
  focusApp: string
  currentRevenueJpy: number
  milestones: RevenueConfigMilestone[]
}

const DEFAULT_REVENUE_CONFIG: RevenueConfig = {
  focusApp: 'birdlog',
  currentRevenueJpy: 0,
  milestones: [
    { id: 'mvp', kind: 'mvp', label: 'BirdLog アプリを完成させる' },
    { id: 'publish', kind: 'publish', label: 'ストアに公開申請する（あなたの作業）' },
    { id: 'monetization_setup', kind: 'monetization_setup', label: '広告・課金を設定する（あなたの作業）' },
    { id: 'download_100', kind: 'static', label: 'ダウンロード100件', state: 'todo', note: 'ストア公開後に計測を開始' },
    { id: 'first_revenue_yen', kind: 'static', label: 'はじめての収益 1円', state: 'todo', note: 'ここがゴール。以降は拡大フェーズ' },
  ],
}

export async function readRevenueConfig(): Promise<RevenueConfig> {
  const config = await readJson<RevenueConfig>('revenue-config.json', DEFAULT_REVENUE_CONFIG)
  return {
    focusApp: config.focusApp || DEFAULT_REVENUE_CONFIG.focusApp,
    currentRevenueJpy: Number.isFinite(config.currentRevenueJpy) ? config.currentRevenueJpy : 0,
    milestones: Array.isArray(config.milestones) && config.milestones.length > 0
      ? config.milestones
      : DEFAULT_REVENUE_CONFIG.milestones,
  }
}

export function formatRevenueJpy(value: number): string {
  return `¥${Math.max(0, Math.trunc(value)).toLocaleString('ja-JP')}`
}
