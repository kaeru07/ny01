import type { Metadata, Viewport } from 'next'
import './globals.css'
import BottomNav from '@/components/navigation/BottomNav'
import TopNav from '@/components/navigation/TopNav'
import { ThemeProvider, ThemeToggle } from '@/components/ThemeProvider'
import HelpModal from '@/components/HelpModal'
import { readExecutionRuns, countUnreviewed } from '@/lib/execution-run-reader'

export const metadata: Metadata = {
  title: 'Progress Dashboard',
  description: 'Claude Code Progress Management',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const runs = await readExecutionRuns()
  const logBadge = countUnreviewed(runs)

  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950 min-h-screen transition-colors">
        <ThemeProvider>
          <div className="fixed top-3 right-3 z-50 flex items-center gap-2 md:hidden">
            <HelpModal />
            <ThemeToggle />
          </div>
          <TopNav logBadge={logBadge} />
          <div className="hidden md:flex max-w-2xl mx-auto px-4 py-2 justify-end gap-2">
            <HelpModal />
            <ThemeToggle />
          </div>
          <div className="max-w-2xl mx-auto min-h-screen">
            <main className="pb-24 md:pb-6">{children}</main>
          </div>
          <BottomNav logBadge={logBadge} />
        </ThemeProvider>
      </body>
    </html>
  )
}
