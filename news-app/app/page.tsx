import { Header } from "@/components/Header";
import { NewsList } from "@/components/NewsList";
import { fetchAllNews, fetchGitHubTrending } from "@/lib/fetchNews";
import { fetchPapers } from "@/lib/fetchPapers";
import { fetchXFeeds } from "@/lib/fetchXFeed";
import { XFeedResult } from "@/lib/types";

export const revalidate = 300; // 5分ごとに再取得

const EMPTY_X_FEED: XFeedResult = {
  items: [],
  isDegraded: false,
  degradedSources: [],
};

export default async function HomePage() {
  const [items, papers, githubItems, xFeedResult] = await Promise.all([
    fetchAllNews(),
    fetchPapers(),
    fetchGitHubTrending(10).catch(() => []),
    fetchXFeeds().catch(() => EMPTY_X_FEED),
  ]);

  const mainItems = items.filter((n) => n.sourceTier === "main");

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* 統計バー */}
        <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 flex-wrap">
          <span>全{mainItems.length}件</span>
          <span>技術{mainItems.filter((n) => n.category === "tech").length}件</span>
          <span>国内{mainItems.filter((n) => n.category === "domestic").length}件</span>
          <span>海外{mainItems.filter((n) => n.category === "international").length}件</span>
          <span>論文{papers.length}件</span>
          <span>GitHub{githubItems.length}件</span>
        </div>

        <NewsList
          initialItems={items}
          papers={papers}
          githubItems={githubItems}
          xFeed={xFeedResult}
        />
      </main>

      {/* iPhoneホームインジケーター用余白 */}
      <div className="h-8" />
    </div>
  );
}
