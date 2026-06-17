'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS } from '@/lib/nav-menu'

// 全画面メニュー（ハンバーガー）。どの画面からでも全ページへ1タップで遷移できる入口。
// 下タブ（BottomNav）・上タブ（TopNav）に出ていない画面もここから必ず辿れる（到達保証の正本）。
// メニュー項目の正本は lib/nav-menu.ts。

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 画面遷移したら自動で閉じる
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // 開いている間は背面スクロールを止める
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="メニューを開く"
        data-usage-label="メニューを開く"
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end" data-usage-ignore>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-[86vw] max-w-sm bg-white dark:bg-gray-900 shadow-xl h-full flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">メニュー（全画面）</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="閉じる"
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <nav className="overflow-y-auto flex-1 px-3 py-3 space-y-4">
              {NAV_GROUPS.map((group) => (
                <section key={group.title}>
                  <h3 className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {group.title}
                  </h3>
                  <ul>
                    {group.links.map((link) => {
                      const active = isActive(link.href)
                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            className={`block rounded-lg px-2 py-2 transition-colors ${
                              active
                                ? 'bg-blue-50 dark:bg-blue-900/30'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                            }`}
                          >
                            <span
                              className={`text-sm font-medium ${
                                active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-100'
                              }`}
                            >
                              {link.label}
                            </span>
                            {link.note && <span className="mt-0.5 block text-[11px] leading-snug text-gray-400">{link.note}</span>}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
