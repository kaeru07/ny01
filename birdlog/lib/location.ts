import type { AnonymizedLocation } from "./types";

/**
 * 場所の匿名化。
 *
 * プライバシー保護のため、精密な GPS 座標は保存しない。
 * - エリア名は前後の空白を除き、長すぎる入力は切り詰める
 * - 座標は 0.1 度（約 11km）に丸めることで自宅・希少種の観察地点の特定を防ぐ
 *
 * 外部ジオコーディング API は使わない（local-first / オフライン動作）。
 */
const COORD_GRID = 0.1;

export function roundCoord(value: number): number {
  return Math.round(value / COORD_GRID) * COORD_GRID;
}

export function anonymizeLocation(input: {
  areaLabel: string;
  lat?: number | null;
  lng?: number | null;
}): AnonymizedLocation | undefined {
  const areaLabel = input.areaLabel.trim().slice(0, 40);
  const hasCoords =
    typeof input.lat === "number" &&
    !Number.isNaN(input.lat) &&
    typeof input.lng === "number" &&
    !Number.isNaN(input.lng);

  if (!areaLabel && !hasCoords) return undefined;

  const location: AnonymizedLocation = { areaLabel };
  if (hasCoords) {
    location.coarseLat = roundCoord(input.lat as number);
    location.coarseLng = roundCoord(input.lng as number);
  }
  return location;
}

export function formatLocation(location?: AnonymizedLocation): string {
  if (!location) return "未設定";
  const parts: string[] = [];
  if (location.areaLabel) parts.push(location.areaLabel);
  if (
    typeof location.coarseLat === "number" &&
    typeof location.coarseLng === "number"
  ) {
    parts.push(
      `約 ${location.coarseLat.toFixed(1)}, ${location.coarseLng.toFixed(1)}`
    );
  }
  return parts.join(" / ") || "未設定";
}
