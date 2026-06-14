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
]

// 下タブに直接出す主要画面（アイコン無しの追加タブ）。リンクで飛べる画面は全てここに載せ、
// 「下タブにない主要画面」を無くす（2026-06-14 ユーザー指示）。横スクロールで全件出す。
const moreItems: Array<{ href: string; label: string }> = [
  { href: '/prompt-queue', label: '作業予約' },
  { href: '/revenue', label: 'Revenue' },
  { href: '/guide', label: '運用' },
  { href: '/logs', label: '実行履歴' },
  { href: '/tasks', label: 'ToDo管理' },
  { href: '/tasks/import', label: 'JSON取込' },
  { href: '/verify-todos', label: '動作確認' },
  { href: '/recommended-epics', label: 'おすすめEpic' },
  { href: '/monetization', label: '収益化' },
  { href: '/approvals', label: '承認' },
  { href: '/automation', label: '自動化' },
  { href: '/epic', label: '工場Epic' },
  { href: '/codex', label: 'Codex' },
  { href: '/morning', label: '朝会' },
  { href: '/daily', label: '日別' },
  { href: '/ai-drive', label: 'AI自走' },
  { href: '/radar', label: 'レーダー' },
  { href: '/projects', label: '案件' },
  { href: '/inbox', label: '旧Inbox' },
  { href: '/decisions', label: '決定事項' },
  { href: '/factory/candidates', label: '工場候補' },
  { href: '/app-urls', label: 'URL' },
  { href: '/legacy/queue', label: '旧キュー' },
  { href: '/legacy/home', label: '旧ダッシュ' },
  { href: '/legacy', label: '画面一覧' },
]

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
      {/* 主要画面はすべて下タブに載せる（横スクロール）。先頭5つはアイコン付きの主要タブ。 */}
      <div className="flex items-stretch overflow-x-auto">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 w-[20vw] max-w-[88px] flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
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
        {moreItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 flex items-center justify-center px-3 py-2 text-[11px] font-medium whitespace-nowrap border-l border-gray-100 dark:border-gray-800 transition-colors ${
              active(item.href)
                ? 'text-blue-500 dark:text-blue-400'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
