"use client";

import type { CatchRecord } from "@/lib/types";
import { WEATHER_LABELS } from "@/lib/types";
import { speciesEmoji, speciesName } from "@/lib/fish-species";
import { formatLocation } from "@/lib/location";

export function CatchList({
  records,
  onDelete,
}: {
  records: CatchRecord[];
  onDelete: (id: string) => void;
}) {
  if (records.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
        まだ釣果がありません。「記録」タブから登録してください。
      </p>
    );
  }

  const sorted = [...records].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <ul className="space-y-3">
      {sorted.map((r) => (
        <li
          key={r.id}
          className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          {r.photoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={r.photoDataUrl}
              alt={speciesName(r.speciesId)}
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-3xl">
              {speciesEmoji(r.speciesId)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-800">
                {speciesEmoji(r.speciesId)} {speciesName(r.speciesId)}
                {typeof r.sizeCm === "number" && (
                  <span className="ml-2 text-sea">{r.sizeCm}cm</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => onDelete(r.id)}
                className="shrink-0 text-xs text-slate-400 hover:text-red-500"
                aria-label="削除"
              >
                削除
              </button>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{r.date}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
              {typeof r.weightG === "number" && <span>{r.weightG}g</span>}
              {r.weather && <span>{WEATHER_LABELS[r.weather]}</span>}
              {r.rig && <span>仕掛け: {r.rig}</span>}
              <span>📍 {formatLocation(r.location)}</span>
            </div>
            {r.memo && (
              <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                {r.memo}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
