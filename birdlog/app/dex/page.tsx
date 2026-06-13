"use client";

import { useMemo } from "react";
import { useObservations } from "@/components/useObservations";
import { BIRDS, SPECIES_TOTAL } from "@/lib/birds";
import { HABITAT_LABELS } from "@/lib/types";
import type { BirdSpecies } from "@/lib/types";

const HABITAT_ORDER: BirdSpecies["habitat"][] = [
  "garden",
  "forest",
  "water",
  "field",
  "raptor",
];

export default function DexPage() {
  const { records, ready } = useObservations();

  const seen = useMemo(
    () => new Set(records.map((r) => r.speciesId)),
    [records]
  );

  const seenCount = useMemo(
    () => BIRDS.filter((b) => seen.has(b.id)).length,
    [seen]
  );
  const pct = Math.round((seenCount / SPECIES_TOTAL) * 100);

  const groups = useMemo(
    () =>
      HABITAT_ORDER.map((habitat) => {
        const list = BIRDS.filter((b) => b.habitat === habitat);
        const got = list.filter((b) => seen.has(b.id)).length;
        return { habitat, list, got };
      }),
    [seen]
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-stone-200 bg-white p-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-base font-bold text-stone-700">図鑑コレクション</h2>
            <p className="text-xs text-stone-500">
              {seenCount} / {SPECIES_TOTAL} 種を観察済み
            </p>
          </div>
          <p className="text-3xl font-bold text-canopy">{pct}%</p>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-stone-100">
          <div
            className="h-full rounded-full bg-forest transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </section>

      {!ready && <p className="text-sm text-stone-400">読み込み中…</p>}

      {groups.map(({ habitat, list, got }) => (
        <section key={habitat}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-700">
              {HABITAT_LABELS[habitat]}
            </h3>
            <span className="text-xs text-stone-500">
              {got} / {list.length}
            </span>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((b) => {
              const got = seen.has(b.id);
              return (
                <li
                  key={b.id}
                  className={`rounded-lg border p-2 text-center ${
                    got
                      ? "border-forest/40 bg-forest/5"
                      : "border-stone-200 bg-stone-50"
                  }`}
                  title={`${b.name} / ${b.nameEn}`}
                >
                  <div
                    className={`text-2xl ${got ? "" : "opacity-30 grayscale"}`}
                    aria-hidden
                  >
                    {got ? b.emoji : "❔"}
                  </div>
                  <p
                    className={`mt-1 truncate text-[11px] ${
                      got ? "font-medium text-stone-800" : "text-stone-400"
                    }`}
                  >
                    {got ? b.name : "未観察"}
                  </p>
                  <p className="truncate text-[10px] text-stone-400">
                    {got ? b.nameEn : b.family}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
