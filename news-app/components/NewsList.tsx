"use client";

import { useState } from "react";
import { NewsItem, PaperItem, FilterTab } from "@/lib/types";
import { NewsCard } from "./NewsCard";
import { PaperCard } from "./PaperCard";
import { CategoryFilter } from "./CategoryFilter";

interface Props {
  initialItems: NewsItem[];
  papers: PaperItem[];
}

export function NewsList({ initialItems, papers }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filtered =
    activeTab === "all"
      ? initialItems
      : activeTab === "paper"
      ? []
      : initialItems.filter((n) => n.category === activeTab);

  return (
    <div>
      {/* カテゴリフィルター */}
      <div className="mb-4">
        <CategoryFilter active={activeTab} onChange={setActiveTab} />
      </div>

      {/* 論文タブ */}
      {activeTab === "paper" && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-amber-700 mb-1">🔬 論文機能 — 開発中</p>
            <p className="text-xs text-amber-600">
              arXiv・Semantic Scholarとの統合を予定しています。
              現在はサンプルデータを表示しています。
            </p>
          </div>
          {papers.map((p) => (
            <PaperCard key={p.id} item={p} />
          ))}
        </div>
      )}

      {/* ニュース一覧 */}
      {activeTab !== "paper" && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm">ニュースがありません</p>
            </div>
          ) : (
            filtered.map((item) => <NewsCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}
