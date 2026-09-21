import './globals.css';

export const metadata = {
  title: '実戦向け何切るトレーナー | 画面検証版',
  description: '捨て牌・副露・ドラ表示牌を見て、手牌を直接タップして回答する何切るトレーナー',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({children}) {
  return <html lang="ja"><body>{children}</body></html>;
}
