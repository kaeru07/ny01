import Link from 'next/link'
import HelpButton from './HelpButton'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/news', label: 'News' },
  { href: '/ideas', label: 'Ideas' },
  { href: '/posts', label: 'Posts' },
  { href: '/report', label: 'Report' },
]

export default function AppNav() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0">
          <p className="text-sm font-semibold text-slate-500">AI Trend SNS Studio</p>
          <h1 className="truncate text-lg font-bold text-ink">AIトレンドSNS運用</h1>
        </Link>
        <div className="flex items-center gap-2">
          <nav className="flex gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex-shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <HelpButton />
        </div>
      </div>
    </header>
  )
}
