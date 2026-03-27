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
          {papers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm">論文を取得できませんでした</p>
            </div>
          ) : (
            papers.map((p) => <PaperCard key={p.id} item={p} />)
          )}
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
