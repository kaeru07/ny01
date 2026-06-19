'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 新UXのボトムナビ（横スクロール）。先頭5つ＝主要タブ（ホーム / ToDo / Project / 目標 / 自動実行）はアイコン付き。
// それ以降は moreItems の全主要画面をテキストタブで列挙し「下タブにない主要画面」を無くす（2026-06-14 ユーザー指示）。
// リンクで飛べる画面は全て下タブから直接到達できる。

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
    href: '/guide',
    label: '運用',
    exact: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8 13h8M8 17h6" />
      </svg>
    ),
  },
]

// 下タブは主要6タブのみ（合計6）。それ以外の全画面は右上の ☰ メニュー（HamburgerMenu）から辿る。
// 以前の moreItems（横スクロールの全画面列挙）は ☰ に集約したため廃止（2026-06-19 ユーザー指示）。

interface Props {
  logBadge?: number
}

export default function BottomNav({ logBadge = 0 }: Props) {
  const pathname = usePathname()

  function active(href: string, exact = false): boolean {
    if (href === '/') return pathname === '/'
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 safe-area-pb md:hidden">
      {/* 主要6タブのみを均等配置。その他の画面は右上 ☰ メニューから。 */}
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
              active(item.href, item.exact)
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
