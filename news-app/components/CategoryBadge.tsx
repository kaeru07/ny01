import { NewsCategory } from "@/lib/types";

const LABELS: Record<NewsCategory, string> = {
  tech: "技術",
  domestic: "国内",
  international: "海外",
  paper: "論文",
};

const COLORS: Record<NewsCategory, string> = {
  tech: "bg-purple-100 text-purple-700 border-purple-200",
  domestic: "bg-emerald-100 text-emerald-700 border-emerald-200",
  international: "bg-amber-100 text-amber-700 border-amber-200",
  paper: "bg-pink-100 text-pink-700 border-pink-200",
};

export function CategoryBadge({ category }: { category: NewsCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${COLORS[category]}`}
    >
      {LABELS[category]}
    </span>
  );
}
