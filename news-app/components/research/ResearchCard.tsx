import Link from "next/link";
import { CATEGORY_META, ResearchDoc } from "@/lib/research/types";
import { summarizeDocTopics } from "@/lib/research/summary";

interface Props {
  doc: ResearchDoc;
}

export function ResearchCard({ doc }: Props) {
  const meta = CATEGORY_META[doc.category];
  const href = meta.hasDetailPage
    ? `/research/${doc.category}/${doc.date}`
    : `/research/${doc.category}`;
  const stats = summarizeDocTopics(doc);

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

        {stats ? (
          <>
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                Topics {stats.topicCount}
              </span>
              {stats.sCount > 0 && (
                <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5">
                  S {stats.sCount}
                </span>
              )}
              {stats.aCount > 0 && (
                <span className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                  A {stats.aCount}
                </span>
              )}
              {stats.todoCount > 0 && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                  Todo {stats.todoCount}
                </span>
              )}
              {stats.staleCount > 0 && (
                <span className="text-[11px] font-semibold text-yellow-800 bg-yellow-100 border border-yellow-300 rounded-full px-2 py-0.5">
                  Stale {stats.staleCount}
                </span>
              )}
            </div>
            {stats.topTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-1.5">
                {stats.topTags.map((t, i) => (
                  <span key={i} className="text-[11px] text-sky-700 break-all">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
              <span className="text-gray-400">TL;DR: </span>
              {stats.tlDr}
            </p>
          </>
        ) : (
          <>
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
          </>
        )}
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
