import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "麻雀読みトレーナー",
  description: "実戦の流れの中で読みを鍛える麻雀トレーニングアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-900 text-gray-100">
        {children}
      </body>
    </html>
  );
}
