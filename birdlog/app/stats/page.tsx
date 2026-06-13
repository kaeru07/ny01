"use client";

import { useMemo } from "react";
import { useObservations } from "@/components/useObservations";
import { statsByMonth, statsBySpecies, totals } from "@/lib/stats";
import { birdEmoji, birdName, SPECIES_TOTAL } from "@/lib/birds";

/** YYYY-MM を「YYYY年M月」に整形（不正値はそのまま返す）。 */
function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return `${y}年${Number(m)}月`;
}

export default function StatsPage() {
  const { records, ready } = useObservations();

  const t = useMemo(() => totals(records), [records]);
  const months = useMemo(() => statsByMonth(records), [records]);
  const species = useMemo(() => statsBySpecies(records), [records]);

  const maxMonthCount = months.reduce((m, x) => Math.max(m, x.count), 1);
  const maxSpeciesCount = species.reduce((m, x) => Math.max(m, x.count), 1);
  const dexPct = Math.round((t.speciesCount / SPECIES_TOTAL) * 100);

  if (ready && records.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-base font-bold text-stone-700">統計</h2>
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          まだ記録がありません。観察を記録すると、月別・種別の統計が表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-stone-700">統計</h2>
        <p className="text-xs text-stone-500">
          端末内（localStorage）の記録だけから集計します。オフラインで動作します。
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="総観察記録" value={t.totalObservations} unit="件" />
        <Stat label="観察した種" value={t.speciesCount} unit={`/ ${SPECIES_TOTAL}`} />
        <Stat label="のべ個体数" value={t.totalIndividuals} unit="羽" />
        <Stat label="図鑑達成" value={dexPct} unit="%" />
      </section>

      {!ready ? (
        <p className="text-sm text-stone-400">読み込み中…</p>
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-sm font-bold text-stone-700">月別の観察</h3>
            <ul className="space-y-2">
              {months.map((m) => (
                <li
                  key={m.month}
                  className="rounded-lg border border-stone-200 bg-white p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-700">
                      {formatMonth(m.month)}
                    </span>
                    <span className="text-stone-500">
                      {m.count} 件 ・ {m.speciesCount} 種
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-forest"
                      style={{ width: `${(m.count / maxMonthCount) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-bold text-stone-700">
              種別の観察（多い順）
            </h3>
            <ul className="space-y-2">
              {species.map((s) => (
                <li
                  key={s.speciesId}
                  className="rounded-lg border border-stone-200 bg-white p-3"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 font-medium text-stone-700">
                      <span className="text-base" aria-hidden>
                        {birdEmoji(s.speciesId)}
                      </span>
                      {birdName(s.speciesId)}
                    </span>
                    <span className="text-stone-500">
                      {s.count} 回 ・ {s.individuals} 羽
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-clay"
                      style={{
                        width: `${(s.count / maxSpeciesCount) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-stone-400">
                    初観察 {s.firstSeen}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 text-center">
      <p className="text-2xl font-bold text-canopy">{value}</p>
      <p className="text-[11px] text-stone-500">
        {label}
        {unit ? ` ${unit}` : ""}
      </p>
    </div>
  );
}
