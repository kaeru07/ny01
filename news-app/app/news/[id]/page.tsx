import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchAllNews } from "@/lib/fetchNews";
import { CategoryBadge } from "@/components/CategoryBadge";
import { formatRelativeTime } from "@/lib/utils";
import { normalizeUrl } from "@/lib/normalizeUrl";

interface Props {
  params: { id: string };
}

export default async function NewsDetailPage({ params }: Props) {
  const id = decodeURIComponent(params.id);
  const items = await fetchAllNews();
  const item = items.find((n) => n.id === id);

  if (!item) notFound();

  const validUrl = normalizeUrl(item.url);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ナビゲーションバー */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-600 active:bg-gray-200 transition-colors"
          >
            ←
          </Link>
          <span className="text-sm font-semibold text-gray-900 truncate">
            ニュース詳細
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-6 pb-24">
        <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          {/* バッジ */}
          <div className="flex items-center gap-2 mb-4">
            <CategoryBadge category={item.category} />
            {item.isSummarized && (
              <span className="text-xs text-blue-500 font-medium">🤖 AI要約</span>
            )}
            <span className="ml-auto text-xs text-gray-400">
              {formatRelativeTime(item.publishedAt)}
            </span>
          </div>

          {/* タイトル */}
          <h1 className="text-base font-bold text-gray-900 leading-snug mb-4">
            {item.title}
          </h1>

          {/* 要約 */}
          <div className="bg-slate-50 rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              要約
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">
              {item.summary}
            </p>
          </div>

          {/* メタ情報 */}
          <div className="flex items-center justify-between text-xs text-gray-400 mb-5">
            <span>ソース: {item.source}</span>
            {item.score !== undefined && (
              <span className="text-orange-500 font-medium">▲ {item.score}点</span>
            )}
          </div>

          {/* 元記事リンク */}
          {validUrl ? (
            <a
              href={validUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-900 text-white text-sm font-semibold py-3 rounded-xl active:bg-gray-700 transition-colors"
            >
              元記事を読む →
            </a>
          ) : (
            <div className="block w-full text-center bg-gray-300 text-gray-500 text-sm font-semibold py-3 rounded-xl cursor-not-allowed">
              リンクなし
            </div>
          )}
        </article>

        {/* 将来の信頼性評価プレースホルダー */}
        <div className="mt-4 bg-white rounded-2xl border border-dashed border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400">
            🔒 信頼性評価機能 — 将来追加予定
          </p>
        </div>
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const id = decodeURIComponent(params.id);
  const items = await fetchAllNews();
  const item = items.find((n) => n.id === id);
  return {
    title: item ? `${item.title} | NewsFlow` : "NewsFlow",
  };
}
