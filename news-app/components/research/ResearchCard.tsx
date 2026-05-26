import Link from "next/link";
import { CATEGORY_META, ResearchDoc } from "@/lib/research/types";

interface Props {
  doc: ResearchDoc;
}

export function ResearchCard({ doc }: Props) {
  const meta = CATEGORY_META[doc.category];
  const href = meta.hasDetailPage
    ? `/research/${doc.category}/${doc.date}`
    : `/research/${doc.category}`;

  return (
    <Link href={href} className="block">
      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:scale-[0.98] transition-transform">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-base">{meta.emoji}</span>
            <span className="text-xs font-medium text-gray-500">
              {meta.label}
            </span>
            {doc.priority && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityClass(doc.priority)}`}
              >
                {doc.priority}
              </span>
            )}
            {doc.partial && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                partial
              </span>
            )}
            {doc.hasError && (
              <span className="text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                error
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-mono">{doc.date}</span>
        </div>

        <h2 className="text-sm font-bold text-gray-900 leading-snug mb-1 line-clamp-2">
          {doc.title}
        </h2>

        {doc.summary && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
            {doc.summary}
          </p>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
          <span>{doc.sections.length} セクション</span>
          {doc.utilization && (
            <span className="text-emerald-600">🧭 活用レビューあり</span>
          )}
        </div>
      </article>
    </Link>
  );
}

function priorityClass(p: "S" | "A" | "B" | "C"): string {
  switch (p) {
    case "S":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "A":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "B":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "C":
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}
