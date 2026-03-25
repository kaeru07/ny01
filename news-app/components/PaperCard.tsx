import { PaperItem } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  item: PaperItem;
}

export function PaperCard({ item }: Props) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
    >
      <article className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-700 border border-pink-200">
            📄 論文
          </span>
          <span className="text-xs text-gray-400">
            {formatRelativeTime(item.publishedAt)}
          </span>
        </div>
        <h2 className="text-sm font-bold text-gray-900 leading-snug mb-1">
          {item.title}
        </h2>
        {item.arxivId && (
          <p className="text-xs text-pink-500 mb-2">arXiv: {item.arxivId}</p>
        )}
        <p className="text-xs text-gray-600 leading-relaxed mb-2">
          {item.summary}
        </p>
        <p className="text-xs text-gray-400">{item.authors.join(", ")}</p>
      </article>
    </a>
  );
}
