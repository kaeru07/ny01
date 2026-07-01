'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SubNavItem } from '@/lib/nav-groups'

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function SubTabBar({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="-mx-1 overflow-x-auto pb-1" aria-label="サブナビゲーション">
      <div className="flex min-w-max gap-2 px-1">
        {items.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${
                active
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm dark:border-blue-500 dark:bg-blue-500'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-900 dark:hover:text-gray-200'
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
