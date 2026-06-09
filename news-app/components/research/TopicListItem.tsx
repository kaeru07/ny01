import Link from "next/link";
import {
  CATEGORY_META,
  ConfidenceLevel,
  Priority,
  SourceType,
  TopicRef,
} from "@/lib/research/types";
import { effectiveSourceDate, isStale } from "@/lib/research/summary";

interface Props {
  refItem: TopicRef;
}

/** tag ページ・todo-candidates・タイムライン等で使う 1 行コンパクト表示。 */
export function TopicListItem({ refItem }: Props) {
  const { topic, category, date } = refItem;
  const meta = CATEGORY_META[category];
  const href = topic.topicId
    ? `/research/topic/${encodeURIComponent(topic.topicId)}`
    : `/research/${category}/${date}`;
  const srcDate = effectiveSourceDate(topic, date);
  const stale = isStale(srcDate);
  const sourceTypes = distinctSourceTypes(topic.references.map((r) => r.sourceType));

  return (
    <Link href={href} className="block active:scale-[0.99] transition-transform">
      <article className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${priorityClass(topic.importance)}`}>
            {topic.importance}
          </span>
          {topic.confidence && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${confidenceClass(topic.confidence)}`}>
              {confidenceLabel(topic.confidence)}
            </span>
          )}
          {topic.todoCandidate && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200">
              ToDo
            </span>
          )}
          {stale && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-yellow-100 text-yellow-800 border-yellow-300">
              古い
            </span>
          )}
          <span className="text-[11px] text-gray-400 ml-auto whitespace-nowrap">
            {meta.emoji} {meta.label}
          </span>
        </div>

        <h3 className="text-sm font-bold text-gray-900 leading-snug break-words line-clamp-2">
          {topic.title}
        </h3>

        {topic.summaryTlDr && (
          <p className="text-xs text-gray-600 leading-relaxed break-words line-clamp-2">
            {topic.summaryTlDr}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-gray-400">
          {sourceTypes.map((s) => (
            <span key={s} className="bg-gray-100 rounded px-1.5 py-0.5 text-gray-500">
              {sourceTypeLabel(s)}
            </span>
          ))}
          <span className="font-mono ml-auto">{topic.updatedAt ?? srcDate}</span>
        </div>
      </article>
    </Link>
  );
}

function distinctSourceTypes(
  types: (SourceType | undefined)[]
): SourceType[] {
  const seen = new Set<SourceType>();
  for (const t of types) {
    if (t && t !== "other") seen.add(t);
  }
  return [...seen].slice(0, 3);
}

function sourceTypeLabel(s: SourceType): string {
  switch (s) {
    case "official":
      return "公式";
    case "reddit":
      return "Reddit";
    case "github":
      return "GitHub";
    case "ranking":
      return "ランキング";
    case "paper":
      return "論文";
    case "social":
      return "SNS";
    case "news":
      return "ニュース";
    default:
      return "他";
  }
}

function confidenceLabel(c: ConfidenceLevel): string {
  return c === "high" ? "確度高" : c === "medium" ? "確度中" : "確度低";
}

function confidenceClass(c: ConfidenceLevel): string {
  switch (c) {
    case "high":
      return "bg-green-600 text-white border-green-600";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-300";
    case "low":
      return "bg-red-100 text-red-700 border-red-400";
  }
}

function priorityClass(p: Priority): string {
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
