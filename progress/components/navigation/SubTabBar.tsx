'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SubNavItem } from '@/lib/nav-groups'

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// 丸ボタンだと他の操作ボタンと見分けが付かないため、下線付きの「タブ」UIにする。
// 下端に境界線を引き、アクティブなタブだけ色付きの下線＋濃い文字で強調する。
export default function SubTabBar({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav
      className="-mx-1 mb-3 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
      aria-label="サブナビゲーション"
    >
      <div className="flex min-w-max gap-1 px-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors ${
                active
                  ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-300'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
