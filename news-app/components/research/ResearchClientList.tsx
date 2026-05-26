"use client";

import { useMemo, useState } from "react";
import { Priority, ResearchDoc } from "@/lib/research/types";
import { ResearchCard } from "./ResearchCard";

interface Props {
  docs: ResearchDoc[];
}

const PRIORITIES: Priority[] = ["S", "A", "B", "C"];

export function ResearchClientList({ docs }: Props) {
  const [keyword, setKeyword] = useState("");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return docs.filter((d) => {
      if (priority !== "all" && d.priority !== priority) return false;
      if (dateFrom && d.date < dateFrom) return false;
      if (dateTo && d.date > dateTo) return false;
      if (kw) {
        const hay = (d.title + " " + d.summary + " " + d.raw).toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [docs, keyword, priority, dateFrom, dateTo]);

  return (
    <div>
      <div className="bg-white rounded-2xl border border-gray-100 p-3 mb-4 space-y-2">
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="キーワード検索（タイトル・本文）"
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-400"
        />
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-xl px-2 py-2"
            aria-label="開始日"
          />
          <span className="text-xs text-gray-400">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="flex-1 text-xs border border-gray-200 rounded-xl px-2 py-2"
            aria-label="終了日"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap pt-1">
          <button
            onClick={() => setPriority("all")}
            className={`text-xs px-3 py-1 rounded-full border ${
              priority === "all"
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            すべて
          </button>
          {PRIORITIES.map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`text-xs px-3 py-1 rounded-full border ${
                priority === p
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              重要度 {p}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 pt-1">
          {filtered.length} / {docs.length} 件
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <ResearchCard key={`${d.category}-${d.date}`} doc={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-4xl mb-3">📭</p>
      <p className="text-sm">条件に合うレポートがありません</p>
    </div>
  );
}
