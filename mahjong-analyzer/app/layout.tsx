import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "麻雀解析AI",
  description: "手牌を入力するとシャンテン数・有効牌・打牌候補を解析します",
  applicationName: "麻雀手牌解析",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "麻雀手牌解析",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f9fafb",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        {children}
      </body>
    </html>
  );
}
