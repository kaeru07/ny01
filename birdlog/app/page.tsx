"use client";

import Link from "next/link";
import { useObservations } from "@/components/useObservations";
import { totals } from "@/lib/stats";
import { SPECIES_TOTAL, birdEmoji, birdName } from "@/lib/birds";
import { formatLocation } from "@/lib/location";

export default function HomePage() {
  const { records, ready } = useObservations();
  const t = totals(records);
  const recent = [...records]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);
  const dexPct = Math.round((t.speciesCount / SPECIES_TOTAL) * 100);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="観察記録" value={t.totalObservations} unit="件" />
        <Stat label="観察した種" value={t.speciesCount} unit={`/ ${SPECIES_TOTAL}`} />
        <Stat label="観察日数" value={t.observationDays} unit="日" />
        <Stat label="図鑑達成" value={dexPct} unit="%" />
      </section>

      <section>
        <Link
          href="/observations?new=1"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white hover:bg-canopy"
        >
          ＋ 観察を記録する
        </Link>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-stone-700">最近の観察</h2>
          <Link href="/observations" className="text-xs text-forest underline">
            すべて見る
          </Link>
        </div>

        {!ready ? (
          <p className="text-sm text-stone-400">読み込み中…</p>
        ) : recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
            まだ記録がありません。最初の野鳥を記録しましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-3"
              >
                <span className="text-2xl" aria-hidden>
                  {birdEmoji(r.speciesId)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-stone-800">
                    {birdName(r.speciesId)}
                  </p>
                  <p className="truncate text-xs text-stone-500">
                    {r.date}
                    {r.time ? ` ${r.time}` : ""} ・{" "}
                    {formatLocation(r.location)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <NavTile href="/dex" icon="📖" label="図鑑" />
        <NavTile href="/map" icon="🗺️" label="目撃マップ" />
        <NavTile href="/stats" icon="📊" label="統計" />
      </section>

      <p className="text-center text-[11px] text-stone-400">
        データは端末内（localStorage）にのみ保存され、オフラインで動作します。
      </p>
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

function NavTile({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 rounded-xl border border-stone-200 bg-white py-4 text-xs text-stone-600 hover:border-forest hover:text-forest"
    >
      <span className="text-2xl" aria-hidden>
        {icon}
      </span>
      {label}
    </Link>
  );
}
