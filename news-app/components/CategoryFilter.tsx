"use client";

import { FilterTab } from "@/lib/types";

const TABS: { id: FilterTab; label: string; emoji: string }[] = [
  { id: "all", label: "すべて", emoji: "📰" },
  { id: "tech", label: "技術", emoji: "⚡" },
  { id: "domestic", label: "国内", emoji: "🇯🇵" },
  { id: "international", label: "海外", emoji: "🌏" },
  { id: "paper", label: "論文", emoji: "📄" },
];

interface Props {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

export function CategoryFilter({ active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            flex-none flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors
            ${
              active === tab.id
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 active:bg-gray-50"
            }
          `}
        >
          <span>{tab.emoji}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
