import { NewsCategory } from "./types";

export type FilterTab = "all" | NewsCategory;

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diff = Math.floor((now - past) / 1000);

  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

export const CATEGORY_LABELS: Record<FilterTab, string> = {
  all: "すべて",
  tech: "技術",
  domestic: "国内",
  international: "海外",
  paper: "論文",
};

export const CATEGORY_COLORS: Record<NewsCategory, string> = {
  tech: "bg-purple-100 text-purple-700",
  domestic: "bg-emerald-100 text-emerald-700",
  international: "bg-amber-100 text-amber-700",
  paper: "bg-pink-100 text-pink-700",
};
