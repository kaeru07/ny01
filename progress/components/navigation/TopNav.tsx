'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// 上部ナビ（デスクトップ用）。
// 新UI（司令塔/Inbox/Projects/Revenue/Legacy）では新5タブを、旧画面では従来の全リンクを表示する。

const newNavItems = [
  { href: '/', label: '司令塔', exact: true },
  { href: '/queue', label: 'キュー', exact: false },
  { href: '/goal-dashboard', label: 'todo消化', exact: false },
  { href: '/activity', label: '実行状況', exact: false },
  { href: '/decide', label: 'Inbox', exact: false },
  { href: '/portfolio', label: 'Projects', exact: false },
  { href: '/app-proposals', label: 'アプリ承認', exact: false },
  { href: '/project-complete', label: 'PJ完了', exact: false },
  { href: '/revenue', label: 'Revenue', exact: false },
  { href: '/report', label: 'レポート', exact: false },
  { href: '/guide', label: '運用', exact: false },
  { href: '/legacy', label: 'Legacy', exact: false },
]

const legacyNavItems = [
  { href: '/', label: '← 新UI', exact: true },
  { href: '/legacy/home', label: '旧ダッシュボード', exact: true },
  { href: '/epic', label: '工場', exact: false },
  { href: '/monetization', label: '収益化', exact: false },
  { href: '/recommended-epics', label: 'おすすめEpic', exact: false },
  { href: '/automation', label: '自動化', exact: false },
  { href: '/approvals', label: '承認', exact: false },
  { href: '/ai-drive', label: 'AI自走', exact: false },
  { href: '/goal-planner', label: '目標', exact: false },
  { href: '/tasks', label: 'ToDo', exact: false },
  { href: '/prompt-queue', label: '作業予約', exact: false },
  { href: '/app-urls', label: 'URL', exact: false },
  { href: '/verify-todos', label: '動作確認', exact: false },
  { href: '/radar', label: 'レーダー', exact: false },
  { href: '/projects', label: '案件', exact: true },
  { href: '/inbox', label: '旧Inbox', exact: false },
  { href: '/logs', label: 'ログ', exact: false },
  { href: '/usage', label: '使用状況', exact: false },
  { href: '/codex', label: 'Codex', exact: false },
  { href: '/daily', label: '日別', exact: false },
]

const NEW_ROUTES = ['/', '/queue', '/goal-dashboard', '/activity', '/decide', '/portfolio', '/app-proposals', '/project-complete', '/revenue', '/report', '/guide', '/legacy']

interface Props {
  logBadge?: number
}

export default function TopNav({ logBadge = 0 }: Props) {
  const pathname = usePathname()
  const onNewRoute = NEW_ROUTES.some((r) => (r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(r + '/')))
  // /legacy/home は旧ダッシュボードなので旧ナビを出す
  const useNewNav = onNewRoute && !pathname.startsWith('/legacy/')
  const navItems = useNewNav ? newNavItems : legacyNavItems

  function isActive(item: (typeof navItems)[number]): boolean {
    if (item.exact) return pathname === item.href
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <nav className="hidden md:block sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-700">
      <div className={`max-w-2xl mx-auto flex items-center gap-1 px-4 h-11 ${useNewNav ? '' : 'overflow-x-auto'}`}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`relative shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              isActive(item)
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {item.label}
            {(item.href === '/logs' || item.href === '/decide') && logBadge > 0 && (
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
