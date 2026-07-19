export interface SubNavItem {
  label: string
  href: string
}

export const STATUS_SUBTABS: SubNavItem[] = [
  { label: 'プロジェクト状況', href: '/portfolio' },
  { label: '自動実行状況', href: '/activity' },
  { label: 'PJ完了', href: '/project-complete' },
]

export const APP_DEVELOPMENT_SUBTABS: SubNavItem[] = [
  { label: '新アプリ案', href: '/app-proposals' },
  { label: '市場分析', href: '/app-market-analysis' },
  { label: '設計一覧', href: '/app-designs' },
  { label: '仕様承認・履歴', href: '/app-specs' },
  { label: 'iOSビルド', href: '/ios-builds' },
  { label: 'iOS署名準備', href: '/ios-signing-guide' },
]

export const AUTO_EXECUTION_SUBTABS: SubNavItem[] = [
  { label: '自動実行', href: '/queue' },
  { label: 'ゴール', href: '/goal-planner' },
  { label: '長期未解消', href: '/stalled-goals' },
]

export const STATUS_PATHS = STATUS_SUBTABS.map((item) => item.href)
export const APP_DEVELOPMENT_PATHS = [...APP_DEVELOPMENT_SUBTABS.map((item) => item.href), '/app-decisions']
export const AUTO_EXECUTION_PATHS = AUTO_EXECUTION_SUBTABS.map((item) => item.href)
