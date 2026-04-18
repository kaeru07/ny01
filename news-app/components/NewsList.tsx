"use client";

import { useState } from "react";
import { NewsItem, PaperItem, FilterTab, XFeedResult } from "@/lib/types";
import { NewsCard } from "./NewsCard";
import { PaperCard } from "./PaperCard";
import { CategoryFilter } from "./CategoryFilter";

interface Props {
  initialItems: NewsItem[];
  papers: PaperItem[];
  githubItems: NewsItem[];
  xFeed: XFeedResult;
}

export function NewsList({ initialItems, papers, githubItems, xFeed }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  // main feed のみ（supplemental/x は別タブ）
  const mainItems = initialItems.filter((n) => n.sourceTier === "main");

  const filtered =
    activeTab === "all"
      ? mainItems
      : activeTab === "paper" || activeTab === "github" || activeTab === "x"
      ? []
      : mainItems.filter((n) => n.category === activeTab);

  return (
    <div>
      <div className="mb-4">
        <CategoryFilter active={activeTab} onChange={setActiveTab} />
      </div>

      {/* 論文タブ */}
      {activeTab === "paper" && (
        <div className="space-y-3">
          {papers.length === 0 ? (
            <EmptyState message="論文を取得できませんでした" />
          ) : (
            papers.map((p) => <PaperCard key={p.id} item={p} />)
          )}
        </div>
      )}

      {/* GitHub Trending タブ */}
      {activeTab === "github" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 mb-2">
            過去7日間に急上昇したGitHubリポジトリ（補助情報）
          </p>
          {githubItems.length === 0 ? (
            <EmptyState message="GitHubトレンドを取得できませんでした" />
          ) : (
            githubItems.map((item) => <NewsCard key={item.id} item={item} />)
          )}
        </div>
      )}

      {/* Xで話題タブ */}
      {activeTab === "x" && (
        <div className="space-y-3">
          {xFeed.isDegraded && xFeed.items.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
              <p className="text-xs text-amber-700">
                ⚠️ Xフィードを取得できませんでした（サービス一時停止中の可能性があります）
              </p>
            </div>
          )}
          {xFeed.isDegraded && xFeed.items.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
              <p className="text-xs text-amber-700">
                ⚠️ 一部ソース（{xFeed.degradedSources.join(", ")}）を取得できませんでした
              </p>
            </div>
          )}
          {xFeed.items.length === 0 && !xFeed.isDegraded ? (
            <EmptyState message="X投稿がありません" />
          ) : xFeed.items.length === 0 ? null : (
            xFeed.items.map((item) => <NewsCard key={item.id} item={item} />)
          )}
          {xFeed.items.length === 0 && xFeed.isDegraded && (
            <EmptyState message="現在Xフィードは利用できません" />
          )}
        </div>
      )}

      {/* ニュース一覧（main feed） */}
      {activeTab !== "paper" && activeTab !== "github" && activeTab !== "x" && (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <EmptyState message="ニュースがありません" />
          ) : (
            filtered.map((item) => <NewsCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">{message}</p>
    </div>
  );
}
