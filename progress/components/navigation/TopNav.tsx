'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'ダッシュボード', exact: true },
  { href: '/morning', label: '朝会', exact: false },
  { href: '/tasks', label: 'ToDo', exact: false },
  { href: '/queue', label: 'キュー', exact: false },
  { href: '/projects', label: '案件', exact: true },
  { href: '/logs', label: 'ログ', exact: false },
  { href: '/daily', label: '日別', exact: false },
]

interface Props {
  logBadge?: number
}

export default function TopNav({ logBadge = 0 }: Props) {
  const pathname = usePathname()

  function isActive(item: (typeof navItems)[number]): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <nav className="hidden md:block sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-2xl mx-auto flex items-center gap-1 px-4 h-11">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item)
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {item.label}
            {item.href === '/logs' && logBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {logBadge > 99 ? '99+' : logBadge}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  )
}
