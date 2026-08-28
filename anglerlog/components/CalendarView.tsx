"use client";

import { useMemo, useState } from "react";
import type { CatchRecord } from "@/lib/types";
import { speciesEmoji, speciesName } from "@/lib/fish-species";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function ymKey(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}`;
}

export function CalendarView({ records }: { records: CatchRecord[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  // 日付 -> 釣果数
  const countByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      if (!r.date) continue;
      map.set(r.date, (map.get(r.date) ?? 0) + 1);
    }
    return map;
  }, [records]);

  const firstWeekday = new Date(year, month0, 1).getDay();
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shift(delta: number) {
    const date = new Date(year, month0 + delta, 1);
    setYear(date.getFullYear());
    setMonth0(date.getMonth());
    setSelected(null);
  }

  function dateStr(day: number): string {
    return `${ymKey(year, month0)}-${String(day).padStart(2, "0")}`;
  }

  const monthTotal = useMemo(() => {
    const prefix = ymKey(year, month0);
    return records.filter((r) => r.date.startsWith(prefix)).length;
  }, [records, year, month0]);

  const selectedRecords = useMemo(
    () => (selected ? records.filter((r) => r.date === selected) : []),
    [records, selected]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          aria-label="前の月"
        >
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">
            {year}年 {month0 + 1}月
          </p>
          <p className="text-[11px] text-slate-400">釣果 {monthTotal} 件</p>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`py-1 text-center text-[11px] font-medium ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-slate-400"
              }`}
            >
              {w}
            </div>
          ))}
          {cells.map((day, idx) => {
            if (day === null) return <div key={`e${idx}`} />;
            const ds = dateStr(day);
            const count = countByDate.get(ds) ?? 0;
            const isSelected = selected === ds;
            return (
              <button
                key={ds}
                type="button"
                onClick={() => setSelected(isSelected ? null : ds)}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition ${
                  isSelected
                    ? "bg-sea text-white"
                    : count > 0
                    ? "bg-sea/10 text-deep hover:bg-sea/20"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <span>{day}</span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 text-[9px] ${
                      isSelected ? "text-white" : "text-sea"
                    }`}
                  >
                    🎣{count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold text-slate-600">
            {selected} の釣果
          </p>
          {selectedRecords.length === 0 ? (
            <p className="text-xs text-slate-400">この日の記録はありません。</p>
          ) : (
            <ul className="space-y-1">
              {selectedRecords.map((r) => (
                <li key={r.id} className="text-xs text-slate-600">
                  {speciesEmoji(r.speciesId)} {speciesName(r.speciesId)}
                  {typeof r.sizeCm === "number" && (
                    <span className="ml-1 text-sea">{r.sizeCm}cm</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
