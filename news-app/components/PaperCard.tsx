import { PaperItem } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface Props {
  item: PaperItem;
}

export function PaperCard({ item }: Props) {
  const translateUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(item.url)}`;
  const pdfUrl = item.arxivId
    ? `https://arxiv.org/pdf/${item.arxivId}`
    : null;

  return (
    <article className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-4">
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
      {item.originalTitle && (
        <p className="text-xs text-gray-400 leading-snug mb-1 line-clamp-2">
          {item.originalTitle}
        </p>
      )}
      {item.arxivId && (
        <p className="text-xs text-pink-500 mb-2">arXiv: {item.arxivId}</p>
      )}
      <p className="text-xs text-gray-600 leading-relaxed mb-2">
        {item.summary}
      </p>
      <p className="text-xs text-gray-400 mb-3">{item.authors.join(", ")}</p>

      {/* リンクボタン */}
      <div className="flex gap-2 flex-wrap">
        <a
          href={translateUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-blue-600 text-white text-xs font-semibold py-2 px-3 rounded-xl active:bg-blue-700 transition-colors"
        >
          🌐 翻訳して読む
        </a>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-center bg-gray-900 text-white text-xs font-semibold py-2 px-3 rounded-xl active:bg-gray-700 transition-colors"
        >
          原文 (arXiv)
        </a>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center bg-pink-100 text-pink-700 text-xs font-semibold py-2 px-3 rounded-xl active:bg-pink-200 transition-colors border border-pink-200"
          >
            PDF
          </a>
        )}
      </div>
    </article>
  );
}
