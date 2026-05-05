import type { Metadata } from 'next'
import './globals.css'
import AppNav from '@/components/AppNav'

export const metadata: Metadata = {
  title: 'AI Trend SNS Studio',
  description: 'AIトレンドSNS運用を管理する小さなWebアプリ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className="font-sans">
        <AppNav />
        <main className="mx-auto min-h-screen max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  )
}
