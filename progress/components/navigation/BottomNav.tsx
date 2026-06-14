'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 新UXのボトムナビ（6タブ）。AI工場の主要導線（ホーム / ToDo / Project / 目標 / 自動実行）＋ その他(旧画面ハブ)。
// 「自動実行」(/queue) を主要タブに昇格し iPhone から必ず辿れるようにした（2026-06-14 ナビ再編）。
// Revenue / 運用(/guide) / Prompt Queue / 旧画面群へは「その他」(/legacy ハブ) から入る。

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
    label: 'ToDo',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h5l2 3h4l2-3h5M3 13l2.5-7h13L21 13M3 13v6h18v-6" />
      </svg>
    ),
  },
  {
    href: '/portfolio',
    label: 'Project',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16v13H4zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
      </svg>
    ),
  },
  {
    href: '/goal-planner',
    label: '目標',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: '/queue',
    label: '自動実行',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
      </svg>
    ),
  },
  {
    href: '/legacy',
    label: 'その他',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
]

// 新タブのルート。これ以外（旧画面・Revenue・運用など）にいる間は「その他」タブを点灯させる。
const NEW_ROUTES = ['/', '/decide', '/portfolio', '/goal-planner', '/queue']

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
