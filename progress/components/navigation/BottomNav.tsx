'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_DEVELOPMENT_PATHS, AUTO_EXECUTION_PATHS, IOS_BUILD_PATHS, STATUS_PATHS } from '@/lib/nav-groups'

const navItems = [
  {
    href: '/',
    label: 'ホーム',
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    href: '/decide',
    label: '今日の判断',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h5l2 3h4l2-3h5M3 13l2.5-7h13L21 13M3 13v6h18v-6" />
      </svg>
    ),
  },
  {
    href: '/queue',
    label: '自動実行',
    exact: false,
    activePaths: AUTO_EXECUTION_PATHS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
      </svg>
    ),
  },
  {
    href: '/app-proposals',
    label: 'アプリ開発',
    exact: false,
    activePaths: APP_DEVELOPMENT_PATHS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="7" y="3" width="10" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 18h2" />
      </svg>
    ),
  },
  {
    href: '/ios-builds',
    label: 'iOSビルド',
    exact: false,
    activePaths: IOS_BUILD_PATHS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <rect x="7" y="2.5" width="10" height="19" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 18.5h2M9.5 7h5M9.5 10h5M9.5 13h3" />
      </svg>
    ),
  },
  {
    href: '/tasks',
    label: 'ToDo',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: '状況',
    exact: false,
    activePaths: STATUS_PATHS,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-8" />
      </svg>
    ),
  },
  {
    href: '/report',
    label: 'レポート',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7zM14 3v5h5M9 13h6M9 17h6" />
      </svg>
    ),
  },
  {
    href: '/guide',
    label: '運用',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 002 2h13" />
      </svg>
    ),
  },
]

interface Props {
  logBadge?: number
}

export default function BottomNav({ logBadge = 0 }: Props) {
  const pathname = usePathname()

  function matchesPath(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function active(item: (typeof navItems)[number]): boolean {
    if (item.activePaths) return item.activePaths.some(matchesPath)
    if (item.exact) return pathname === item.href
    return matchesPath(item.href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 safe-area-pb md:hidden">
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              active(item)
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            <div className="relative">
              {item.icon}
              {item.href === '/decide' && logBadge > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                  {logBadge > 99 ? '99+' : logBadge}
                </span>
              )}
            </div>
            <span className="text-center font-medium leading-none">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
