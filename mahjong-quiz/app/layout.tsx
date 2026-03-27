import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '麻雀待ち牌クイズ',
  description: '上位層の牌譜を元にした待ち牌を当てる学習アプリ',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full bg-gray-50 antialiased">{children}</body>
    </html>
  )
}
