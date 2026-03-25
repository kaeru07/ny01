import Link from "next/link";
import { NewsItem } from "@/lib/types";
import { CategoryBadge } from "./CategoryBadge";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  item: NewsItem;
}

export function NewsCard({ item }: Props) {
  return (
    <Link href={`/news/${encodeURIComponent(item.id)}`} className="block">
      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform">
        {/* ヘッダー: バッジ + 時刻 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CategoryBadge category={item.category} />
            {item.isSummarized && (
              <span className="text-xs text-blue-500 font-medium">🤖 AI要約</span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(item.publishedAt)}
          </span>
        </div>

        {/* タイトル */}
        <h2 className="text-sm font-bold text-gray-900 leading-snug mb-2 line-clamp-3">
          {item.title}
        </h2>

        {/* 要約 */}
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
          {item.summary}
        </p>

        {/* フッター */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-gray-400">{item.source}</span>
          {item.score !== undefined && (
            <span className="text-xs text-orange-500 font-medium">
              ▲ {item.score}
            </span>
          )}
        </div>
      </article>
    </Link>
  );
}
