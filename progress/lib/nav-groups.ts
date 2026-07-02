export interface SubNavItem {
  label: string
  href: string
}

export const STATUS_SUBTABS: SubNavItem[] = [
  { label: '状況', href: '/activity' },
  { label: 'PJ完了', href: '/project-complete' },
  { label: 'プロジェクト状況', href: '/portfolio' },
]

export const APP_DEVELOPMENT_SUBTABS: SubNavItem[] = [
  { label: '新アプリ案', href: '/app-proposals' },
  { label: '既存アプリ仕様承認', href: '/app-specs' },
  { label: '設計一覧', href: '/app-designs' },
  { label: '承認・方針決定歴', href: '/app-decisions' },
]

export const AUTO_EXECUTION_SUBTABS: SubNavItem[] = [
  { label: '自動実行', href: '/queue' },
  { label: 'ゴール', href: '/goal-planner' },
]

export const STATUS_PATHS = STATUS_SUBTABS.map((item) => item.href)
export const APP_DEVELOPMENT_PATHS = APP_DEVELOPMENT_SUBTABS.map((item) => item.href)
export const AUTO_EXECUTION_PATHS = AUTO_EXECUTION_SUBTABS.map((item) => item.href)
