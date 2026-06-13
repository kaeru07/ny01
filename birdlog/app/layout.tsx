import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "BirdLog — 野鳥観察記録",
  description:
    "オフラインで動く野鳥の観察記録・図鑑コレクション・目撃マップ。local-first（端末内に保存）。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#15803d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
            <span className="text-2xl" aria-hidden>
              🦜
            </span>
            <div>
              <h1 className="text-lg font-bold leading-tight text-canopy">
                BirdLog
              </h1>
              <p className="text-xs text-stone-500">
                野鳥観察記録 — オフラインで動く（端末内保存）
              </p>
            </div>
          </div>
        </header>
        <main className="app-shell">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
