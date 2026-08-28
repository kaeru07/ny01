"use client";

import { useEffect, useState } from "react";
import type { CatchRecord } from "@/lib/types";
import {
  addCatch,
  deleteCatch,
  generateId,
  loadCatches,
} from "@/lib/storage";
import { CatchForm } from "@/components/CatchForm";
import { CatchList } from "@/components/CatchList";
import { CalendarView } from "@/components/CalendarView";
import { StatsView } from "@/components/StatsView";
import { AdSlot, SubscriptionCard } from "@/components/MonetizationSlots";

type Tab = "record" | "list" | "calendar" | "stats";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "record", label: "記録", icon: "📝" },
  { id: "list", label: "一覧", icon: "🐟" },
  { id: "calendar", label: "カレンダー", icon: "📅" },
  { id: "stats", label: "統計", icon: "📊" },
];

export default function Home() {
  const [records, setRecords] = useState<CatchRecord[]>([]);
  const [tab, setTab] = useState<Tab>("record");
  const [hydrated, setHydrated] = useState(false);

  // localStorage はクライアントのみ。マウント後に読み込む。
  useEffect(() => {
    setRecords(loadCatches());
    setHydrated(true);
  }, []);

  function handleAdd(input: Omit<CatchRecord, "id" | "createdAt">) {
    const record: CatchRecord = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    try {
      setRecords(addCatch(record));
      setTab("list");
    } catch (e) {
      // localStorage 容量超過など
      alert(
        "保存に失敗しました。写真サイズが大きすぎる可能性があります。\n" +
          (e instanceof Error ? e.message : String(e))
      );
    }
  }

  function handleDelete(id: string) {
    if (!confirm("この釣果を削除しますか？")) return;
    setRecords(deleteCatch(id));
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg pb-24">
      <header className="bg-gradient-to-r from-sea to-deep px-4 py-5 text-white">
        <h1 className="text-lg font-bold">🎣 AnglerLog</h1>
        <p className="mt-0.5 text-xs text-white/80">
          釣行記録 — 端末内に保存（オフライン対応 / 場所は匿名化）
        </p>
      </header>

      <div className="px-4 pt-4">
        <AdSlot />
      </div>

      <div className="space-y-4 px-4 py-4">
        {!hydrated ? (
          <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
        ) : (
          <>
            {tab === "record" && (
              <>
                <CatchForm onAdd={handleAdd} />
                <SubscriptionCard />
              </>
            )}
            {tab === "list" && (
              <CatchList records={records} onDelete={handleDelete} />
            )}
            {tab === "calendar" && <CalendarView records={records} />}
            {tab === "stats" && (
              <>
                <StatsView records={records} />
                <SubscriptionCard />
              </>
            )}
          </>
        )}
      </div>

      <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-lg border-t border-slate-200 bg-white">
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                tab === t.id ? "text-sea" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}
