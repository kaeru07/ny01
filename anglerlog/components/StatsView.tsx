"use client";

import { useMemo } from "react";
import type { CatchRecord } from "@/lib/types";
import {
  personalRecords,
  statsByMonth,
  statsBySpecies,
  totals,
} from "@/lib/stats";
import { speciesEmoji } from "@/lib/fish-species";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </section>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-slate-100">
      <div
        className="h-2 rounded-full bg-sea"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatsView({ records }: { records: CatchRecord[] }) {
  const summary = useMemo(() => totals(records), [records]);
  const bySpecies = useMemo(() => statsBySpecies(records), [records]);
  const byMonth = useMemo(() => statsByMonth(records), [records]);
  const records9 = useMemo(() => personalRecords(records), [records]);

  if (records.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
        統計を表示するには釣果を記録してください。
      </p>
    );
  }

  const maxSpeciesCount = Math.max(...bySpecies.map((s) => s.count), 1);
  const maxMonthCount = Math.max(...byMonth.map((m) => m.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "総釣果数", value: summary.totalCatches },
          { label: "魚種数", value: summary.speciesCount },
          { label: "釣行日数", value: summary.tripDays },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm"
          >
            <p className="text-2xl font-bold text-deep">{c.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      <Section title="魚種別">
        <ul className="space-y-2">
          {bySpecies.map((s) => (
            <li key={s.speciesId}>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>
                  {speciesEmoji(s.speciesId)} {s.name}
                  {typeof s.maxSizeCm === "number" && (
                    <span className="ml-1 text-slate-400">
                      最大 {s.maxSizeCm}cm
                    </span>
                  )}
                </span>
                <span className="font-medium">{s.count}</span>
              </div>
              <Bar value={s.count} max={maxSpeciesCount} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="月別">
        <ul className="space-y-2">
          {byMonth.map((m) => (
            <li key={m.month}>
              <div className="mb-1 flex justify-between text-xs text-slate-600">
                <span>{m.month}</span>
                <span className="font-medium">{m.count}</span>
              </div>
              <Bar value={m.count} max={maxMonthCount} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="自己記録（魚種別 最大サイズ）">
        {records9.length === 0 ? (
          <p className="text-xs text-slate-400">
            サイズを入力した釣果がまだありません。
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {records9.map((r) => (
              <li
                key={r.catchId}
                className="flex items-center justify-between py-2 text-xs"
              >
                <span className="text-slate-600">
                  {speciesEmoji(r.speciesId)} {r.name}
                </span>
                <span className="text-slate-400">{r.date}</span>
                <span className="font-bold text-sea">{r.sizeCm}cm</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
