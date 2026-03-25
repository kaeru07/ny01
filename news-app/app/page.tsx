import { Header } from "@/components/Header";
import { NewsList } from "@/components/NewsList";
import { fetchAllNews } from "@/lib/fetchNews";
import { mockPapers } from "@/lib/mockData";

export const revalidate = 300; // 5分ごとに再取得

export default async function HomePage() {
  const items = await fetchAllNews();
  const papers = mockPapers; // 将来: fetchPapers() に差し替え

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* 統計バー */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
          <span>全{items.length}件</span>
          <span>技術{items.filter(n => n.category === "tech").length}件</span>
          <span>国内{items.filter(n => n.category === "domestic").length}件</span>
          <span>海外{items.filter(n => n.category === "international").length}件</span>
        </div>

        <NewsList initialItems={items} papers={papers} />
      </main>

      {/* iPhoneホームインジケーター用余白 */}
      <div className="h-8" />
    </div>
  );
}
