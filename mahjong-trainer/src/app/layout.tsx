import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "麻雀実戦読みトレーナー",
  description: "実戦の流れの中で読みを鍛える麻雀トレーニングアプリ",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="min-h-full">
      <body className="min-h-screen bg-gray-900 text-gray-100">
        {children}
      </body>
    </html>
  );
}
