'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 新UXのボトムナビ（6タブ）。旧画面群へは Legacy タブから入る。
// 旧ナビ項目（朝会/工場/収益化/推奨Epic/目標/ToDo/キュー/URL/レーダー/案件/ログ）は
// /legacy ハブと TopNav（旧画面でのみ表示）から引き続き利用できる。

const navItems = [
  {
    href: '/',
    label: '司令塔',
    exact: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    href: '/decide',
    label: 'Inbox',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h5l2 3h4l2-3h5M3 13l2.5-7h13L21 13M3 13v6h18v-6" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Projects',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16v13H4zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </svg>
    ),
  },
  {
    href: '/revenue',
    label: 'Revenue',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v10M9.5 9.5h3.2a1.8 1.8 0 010 3.6H10m-.5 0h3.5" />
      </svg>
    ),
  },
  {
    href: '/guide',
    label: '運用',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5C10.5 5 8.5 4.5 5 4.5v13c3.5 0 5.5.5 7 2 1.5-1.5 3.5-2 7-2v-13c-3.5 0-5.5.5-7 2zM12 6.5v13" />
      </svg>
    ),
  },
  {
    href: '/legacy',
    label: 'Legacy',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
      </svg>
    ),
  },
]

// 新タブのルート。これ以外（旧画面）にいる間は Legacy タブを点灯させる。
const NEW_ROUTES = ['/', '/decide', '/portfolio', '/revenue', '/guide']

interface Props {
  logBadge?: number
}

export default function BottomNav({ logBadge = 0 }: Props) {
  const pathname = usePathname()
  const onNewRoute = NEW_ROUTES.some((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/')))

  function isActive(item: (typeof navItems)[number]): boolean {
    if (item.href === '/legacy') {
      return pathname === '/legacy' || pathname.startsWith('/legacy/') || !onNewRoute
    }
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 safe-area-pb md:hidden">
      <div className="max-w-2xl mx-auto flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              isActive(item)
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
            <span className="font-medium leading-none">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
