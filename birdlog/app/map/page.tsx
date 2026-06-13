"use client";

import { useMemo, useState } from "react";
import { useObservations } from "@/components/useObservations";
import {
  MAP_H,
  MAP_W,
  buildPoints,
  buildTiles,
  inBounds,
  type MapPoint,
} from "@/lib/geo";
import { birdEmoji, birdName } from "@/lib/birds";

export default function MapPage() {
  const { records, ready } = useObservations();
  const [selected, setSelected] = useState<MapPoint | null>(null);

  const tiles = useMemo(() => buildTiles(), []);
  const points = useMemo(
    () => buildPoints(records).filter((p) => inBounds(p.lat, p.lng)),
    [records]
  );

  const withCoords = records.filter(
    (r) =>
      typeof r.location?.coarseLat === "number" &&
      typeof r.location?.coarseLng === "number"
  ).length;
  const maxCount = points.reduce((m, p) => Math.max(m, p.count), 1);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-stone-700">目撃マップ</h2>
        <p className="text-xs text-stone-500">
          通信なしで動くオフライン地図（端末内グリッドタイル）。座標は 0.1 度に丸めて表示します。
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-sky/5">
        <svg
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="w-full"
          role="img"
          aria-label="目撃マップ（オフライン）"
        >
          {/* 海の背景 */}
          <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="#e0f2fe" />

          {/* 手続き生成のオフラインタイル（市松グリッド） */}
          {tiles.map((t, i) => (
            <rect
              key={i}
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              fill={t.even ? "#f1f5f9" : "#e2e8f0"}
              stroke="#cbd5e1"
              strokeWidth={0.3}
            />
          ))}

          {/* 観察ポイント */}
          {points.map((p) => {
            const r = 3 + (p.count / maxCount) * 6;
            const active = selected?.key === p.key;
            return (
              <g
                key={p.key}
                onClick={() => setSelected(p)}
                className="cursor-pointer"
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={active ? "#15803d" : "#f59e0b"}
                  fillOpacity={0.8}
                  stroke="#fff"
                  strokeWidth={1}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {!ready ? (
        <p className="text-sm text-stone-400">読み込み中…</p>
      ) : withCoords === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">
          座標付きの記録がありません。記録時に「📍 現在地を粗く記録」を使うとマップに表示されます。
        </p>
      ) : (
        <p className="text-xs text-stone-500">
          座標付き記録 {withCoords} 件 / 目撃地点 {points.length} か所。マーカーをタップすると内訳を表示します。
        </p>
      )}

      {selected && (
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-700">
              この地点（約 {selected.lat.toFixed(1)}, {selected.lng.toFixed(1)}）
            </h3>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-stone-400 underline"
            >
              閉じる
            </button>
          </div>
          <p className="mb-2 text-xs text-stone-500">
            記録 {selected.count} 件 / {selected.speciesIds.length} 種
          </p>
          <ul className="flex flex-wrap gap-2">
            {selected.speciesIds.map((id) => (
              <li
                key={id}
                className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-700"
              >
                <span aria-hidden>{birdEmoji(id)}</span>
                {birdName(id)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
