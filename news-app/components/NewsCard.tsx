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
              <span className="text-xs text-blue-500 font-medium">🌐 翻訳済</span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(item.publishedAt)}
          </span>
        </div>

        {/* タイトル（日本語） */}
        <h2 className="text-sm font-bold text-gray-900 leading-snug mb-1 line-clamp-3">
          {item.title}
        </h2>

        {/* 英語原題（翻訳済みの場合のみ表示） */}
        {item.originalTitle && (
          <p className="text-xs text-gray-400 leading-snug line-clamp-2 mb-2">
            {item.originalTitle}
          </p>
        )}

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
